import { customElement, property, state } from 'lit/decorators.js'
import { LitElement, html, nothing, unsafeCSS } from 'lit'
import '@fontsource/roboto'
import '@fontsource/material-icons'
import styles from './styles.css?inline'
import { globalStyles } from './styles'
import './editor'
import './viewer'
import './filter-modal'
import { APP_PATH, BACKEND_URL } from './constants'
import { showSnackbarMessage } from '@ro-kit/ui-widgets'
import { initFacets } from './facets'
import { Facet } from './facets/base'
import { ProfileFacet } from './facets/profile'
import { search, SearchDocument } from './solr'
import { fetchLabels, i18n } from './i18n'
import { Editor } from './editor'
import { map } from 'lit/directives/map.js'
import { registerPlugin } from '@ulb-darmstadt/shacl-form'
import { LeafletPlugin } from '@ulb-darmstadt/shacl-form/plugins/leaflet.js'
import { Facets } from './facets/base'
import { KeywordFacet } from './facets/keyword'
import { NumberRangeFacet } from './facets/number-range'

export type Config = {
    layout: string
    profiles: string[]
    index: string
    geoDataType: string
    solrMaxAggregations: number
    authEnabled: boolean
    authWriteAccess: boolean
    authUser: string
    authEmail: string
    contactEmail: string
    rdfNamespace: string
}

@customElement('rdf-store')
export class App extends LitElement {
    static styles = [unsafeCSS(styles), globalStyles]

    @property() offset = 0
    @property() limit = 10
    @property() searchTerm = ''
    @property() searchCreator?: string

    @state() searchHits: SearchDocument[] = []
    @state() facets?: Facets
    @state() totalHits = 0
    @state() viewRdfSubject?: string
    @state() viewHiglightSubject?: string
    @state() config: Config | undefined

    @state() filterModalOpen = false
    @state() sidebarCollapsed = false
    @state() profileSearch = ''
    @state() resultsSearch = ''
    @state() selectedProfile = ''

    debounceTimeout: ReturnType<typeof setTimeout> | undefined

    handleLocationChange = () => {
        // Restore profile selection from URL query param (handles back/forward)
        if (this.facets) {
            const profileFromUrl = new URL(window.location.href).searchParams.get('profile') || ''
            if (profileFromUrl !== this.selectedProfile) {
                const profileFacet = this.getProfileFacet()
                if (profileFacet) {
                    this.selectedProfile = profileFromUrl
                    profileFacet.selectedValue = profileFromUrl
                    profileFacet.active = !!profileFromUrl
                    this.filterChanged()
                }
            }
        }

        // Restore resource viewer from URL path
        const index = window.location.pathname.indexOf('/resource/')
        if (index > -1) {
            const id = window.location.pathname.substring(index + 10)
            if (id && this.config) {
                this.viewRdfSubject = this.config.rdfNamespace + id
                // Clear sub-highlight so the active card is determined by viewRdfSubject
                this.viewHiglightSubject = undefined
            }
        } else {
            this.viewRdfSubject = undefined
            this.viewHiglightSubject = undefined
        }
    }

    connectedCallback() {
        super.connectedCallback()
        window.addEventListener('popstate', this.handleLocationChange)
    }

    disconnectedCallback() {
        super.disconnectedCallback()
        window.removeEventListener('popstate', this.handleLocationChange)
    }

    viewResource(subject: string | SearchDocument | null) {
        let path = APP_PATH
        if (subject) {
            path += 'resource/'
            if (typeof subject === 'string') {
                path += subject.replace(this.config?.rdfNamespace ?? '', '')
            } else {
                path += subject._root_.replace(this.config?.rdfNamespace ?? '', '')
                this.viewHiglightSubject = subject.id
            }
        }
        history.pushState('', '', path)
        this.handleLocationChange()
    }

    async firstUpdated() {
        try {
            const resp = await fetch(`${BACKEND_URL}/config`)
            if (!resp.ok) throw 'Failed loading application configuration'
            this.config = await resp.json() as Config
            await this.applyLayout(this.config.layout || 'default')
            await fetchLabels(this.config.profiles, true)
            this.facets = await initFacets(this.config.index, this.config.solrMaxAggregations)

            // Restore profile from URL on page load (e.g. bookmarked URL or reload)
            const profileFromUrl = new URL(window.location.href).searchParams.get('profile') || ''
            if (profileFromUrl) {
                const profileFacet = this.getProfileFacet()
                if (profileFacet) {
                    this.selectedProfile = profileFromUrl
                    profileFacet.selectedValue = profileFromUrl
                    profileFacet.active = true
                }
            }

            if (this.config.geoDataType) {
                registerPlugin(new LeafletPlugin({ datatype: this.config.geoDataType }))
            }
            if (this.config.authEnabled && this.config.authUser && !this.config.authWriteAccess) {
                let message = 'You don\'t currently have the necessary permissions to create resources.'
                if (this.config.contactEmail) {
                    const subject = encodeURIComponent(`Request for write access to ${window.location.href}`)
                    const body = encodeURIComponent(`Hi,\n\nI need write access to ${window.location.href}.\n\nBest regards\n`)
                    message += ` Please contact<br><a href="mailto:${this.config.contactEmail}?subject=${subject}&body=${body}">${this.config.contactEmail}</a><br>to request access.`
                }
                showSnackbarMessage({ message, ttl: 0, cssClass: 'error' })
            }
            this.filterChanged()
            this.handleLocationChange()
        } catch (e) {
            console.error(e)
            showSnackbarMessage({ message: '' + e, ttl: 0, cssClass: 'error' })
        }
    }

    filterChanged(fromPager = false) {
        this.shadowRoot?.querySelector('#app')?.classList.add('loading')
        clearTimeout(this.debounceTimeout)
        this.debounceTimeout = setTimeout(async () => {
            try {
                if (!fromPager) this.offset = 0
                const searchResult = await search(this.config!.index, {
                    offset: this.offset,
                    limit: this.limit,
                    sort: `lastModified desc`,
                    term: this.searchTerm,
                    creator: this.searchCreator,
                    facets: this.facets,
                })
                if (searchResult.error) {
                    throw searchResult.error.msg || searchResult.error.trace
                }
                this.totalHits = searchResult.response.numFound
                this.searchHits = searchResult.response.docs
            } catch (e) {
                console.error(e)
                showSnackbarMessage({ message: '' + e, ttl: 0, cssClass: 'error' })
            } finally {
                this.shadowRoot?.querySelector('#app')?.classList.remove('loading')
            }
        }, 20)
    }

    openEditor() {
        const editor = this.shadowRoot!.querySelector<Editor>('rdf-editor')
        if (editor) editor.open = true
    }

    async applyLayout(layout: string) {
        let icon = document.head.querySelector<HTMLLinkElement>("link[rel='icon']")
        if (!icon) {
            icon = document.createElement('link')
            icon.rel = 'icon'
            document.head.appendChild(icon)
        }
        icon.href = new URL(`./layouts/${layout}/favicon.png`, import.meta.url).href
        document.body.dataset['layout'] = layout
        await import(`./layouts/${layout}/layout.ts`)
    }

    getPagerItems(totalPages: number, currentPage: number) {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, index) => index + 1)
        }
        const pages = new Set<number>([1, totalPages])
        for (let page = currentPage - 2; page <= currentPage + 2; page++) {
            if (page > 1 && page < totalPages) pages.add(page)
        }
        const sortedPages = Array.from(pages).sort((a, b) => a - b)
        const items: Array<number | 'ellipsis'> = []
        let previousPage = 0
        for (const page of sortedPages) {
            if (previousPage && page - previousPage > 1) items.push('ellipsis')
            items.push(page)
            previousPage = page
        }
        return items
    }

    private getProfileFacet(): ProfileFacet | undefined {
        return this.facets?.facets['']?.[0] as ProfileFacet | undefined
    }

    private selectProfile(profileValue: string) {
        const profileFacet = this.getProfileFacet()
        if (!profileFacet) return
        const next = profileValue === this.selectedProfile ? '' : profileValue
        this.selectedProfile = next
        profileFacet.selectedValue = next
        profileFacet.active = !!next
        this.offset = 0

        // Push profile into URL so back/forward restores it
        const url = new URL(window.location.href)
        if (next) {
            url.searchParams.set('profile', next)
        } else {
            url.searchParams.delete('profile')
        }
        history.pushState('', '', url.toString())

        this.filterChanged()
    }

    private resetAllFilters() {
        if (!this.facets) return
        for (const profile of Object.keys(this.facets.facets)) {
            for (const facet of this.facets.facets[profile]) {
                facet.active = false
                if (facet instanceof KeywordFacet) facet.selectedValue = ''
                if (facet instanceof NumberRangeFacet) {
                    facet.value = undefined
                    facet.lastSelectedValue = undefined
                }
            }
        }
        this.selectedProfile = ''
        this.searchTerm = ''
        this.resultsSearch = ''
        this.offset = 0
        this.filterChanged()
    }

    // Resets only the applied facet filters (chips), keeping profile and search term intact
    private resetFacetFilters() {
        if (!this.facets) return
        for (const profile of Object.keys(this.facets.facets)) {
            for (const facet of this.facets.facets[profile]) {
                if (facet instanceof ProfileFacet) continue
                facet.active = false
                if (facet instanceof KeywordFacet) facet.selectedValue = ''
                if (facet instanceof NumberRangeFacet) {
                    facet.value = undefined
                    facet.lastSelectedValue = undefined
                }
            }
        }
        this.offset = 0
        this.filterChanged()
    }

    private getActiveFilterChips(): string[] {
        const chips: string[] = []
        if (!this.facets) return chips
        for (const profile of Object.keys(this.facets.facets)) {
            for (const facet of this.facets.facets[profile]) {
                if (!facet.active) continue
                if (facet instanceof ProfileFacet) continue // profile shown in sidebar
                if (facet instanceof KeywordFacet && facet.selectedValue) {
                    chips.push(i18n[String(facet.selectedValue)] || String(facet.selectedValue))
                } else if (facet instanceof NumberRangeFacet && facet.value) {
                    chips.push(`${facet.value[0]}-${facet.value[1]}`)
                }
            }
        }
        return chips
    }

    private getModalFacets(): Facet[] {
        if (!this.facets) return []
        const profileKey = this.selectedProfile || ''
        const profileFacets = this.facets.facets[profileKey] ?? []
        if (profileFacets.length > 0) {
            return profileFacets.filter(f => f.valid && !(f instanceof ProfileFacet))
        }
        // fallback: all non-profile facets across all profiles
        return Object.values(this.facets.facets)
            .flat()
            .filter(f => f.valid && !(f instanceof ProfileFacet))
    }

    render() {
        if (!this.config) return html`<rokit-snackbar></rokit-snackbar>`

        const profileFacet = this.getProfileFacet()
        const allProfiles = profileFacet?.values ?? []
        const filteredProfiles = this.profileSearch
            ? allProfiles.filter(p => (i18n[String(p.value)] || String(p.value)).toLowerCase().includes(this.profileSearch.toLowerCase()))
            : allProfiles

        const filteredHits = this.resultsSearch
            ? this.searchHits.filter(h => (h.label?.join(' ') || h.id).toLowerCase().includes(this.resultsSearch.toLowerCase()))
            : this.searchHits

        const activeChips = this.getActiveFilterChips()
        const modalFacets = this.getModalFacets()

        return html`
            <layout-header
                @reset-filters="${this.resetAllFilters}"
            >
                <div id="header-buttons">
                    ${!this.config.authWriteAccess ? nothing : html`
                        <rokit-button primary @click="${() => this.openEditor()}">
                            <span class="material-icons">add</span>${i18n['add_resource']}
                        </rokit-button>
                    `}
                    ${!this.config.authEnabled || this.config.authUser ? nothing : html`
                        <rokit-button primary href="${APP_PATH}oauth2/sign_in">
                            <span class="material-icons icon">login</span>${i18n['sign_in']}
                        </rokit-button>
                    `}
                    ${!this.config.authEnabled || !this.config.authUser ? nothing : html`
                        <a id="sign-out" href="${APP_PATH}oauth2/sign_out">
                            ${i18n['sign_out']} ${this.config.authEmail || this.config.authUser}
                        </a>
                    `}
                </div>
            </layout-header>

            <div id="app">
                <rokit-progressbar class="progress"></rokit-progressbar>

                <!-- Left sidebar: profile navigation -->
                <aside id="sidebar" class="${this.sidebarCollapsed ? 'collapsed' : ''}">
                    <div class="sidebar-search">
                        <span class="material-icons">search</span>
                        <input
                            type="text"
                            placeholder="${i18n['fulltextsearch'] || 'Search across metadata'}"
                            .value="${this.searchTerm}"
                            @input="${(e: Event) => {
                                this.searchTerm = (e.target as HTMLInputElement).value
                                this.filterChanged()
                            }}"
                        >
                    </div>
                    <div class="profile-list">
                        ${filteredProfiles.map(p => html`
                            <div
                                class="profile-item ${String(p.value) === this.selectedProfile ? 'active' : ''}"
                                @click="${() => this.selectProfile(String(p.value))}"
                            >
                                <span class="material-icons profile-icon">description</span>
                                <div>
                                    <div class="profile-name">${i18n[String(p.value)] || p.value}</div>
                                </div>
                            </div>
                        `)}
                    </div>
                    <button
                        class="collapse-btn"
                        title="${this.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}"
                        @click="${() => { this.sidebarCollapsed = !this.sidebarCollapsed }}"
                    >
                        <span class="material-icons">${this.sidebarCollapsed ? 'chevron_right' : 'chevron_left'}</span>
                    </button>
                </aside>

                <!-- Middle: results list -->
                <div id="results-col">
                    <div class="results-header">
                        <h2>${i18n['results'] ? i18n['results'].split(' ')[0] : 'Results'}</h2>
                    </div>
                    <div class="results-count">${this.totalHits} results found</div>
                    <div class="results-search">
                        <span class="material-icons">search</span>
                        <input
                            type="text"
                            placeholder="Search results..."
                            .value="${this.resultsSearch}"
                            @input="${(e: Event) => { this.resultsSearch = (e.target as HTMLInputElement).value }}"
                        >
                    </div>
                    <div class="result-cards">
                        ${filteredHits.length === 0 && this.totalHits === 0 ? html`
                            <div class="no-results">${i18n['noresults'] || 'No results found'}</div>
                        ` : filteredHits.map(hit => html`
                            <div
                                class="result-card ${(hit.id === this.viewHiglightSubject || (!this.viewHiglightSubject && hit.id === this.viewRdfSubject)) ? 'active' : ''}"
                                @click="${() => this.viewResource(hit)}"
                            >
                                <div class="result-title">${hit.label?.length ? hit.label.join(', ') : hit.id}</div>
                                <div class="result-meta">${i18n['shape'] || 'Profile'}: ${hit.shape?.length ? (i18n[hit.shape[0]] || hit.shape[0]) : 'No profile'}</div>
                                ${hit.lastModified ? html`<div class="result-meta">${i18n['last_modified'] || 'Last modified'}: ${new Date(hit.lastModified).toDateString()}</div>` : nothing}
                            </div>
                        `)}
                        ${this.totalHits > this.limit ? html`
                            <div class="pager">
                                ${map(
                                    this.getPagerItems(Math.ceil(this.totalHits / this.limit), Math.floor(this.offset / this.limit) + 1),
                                    item => item === 'ellipsis'
                                        ? html`<span class="ellipsis">…</span>`
                                        : html`
                                            <rokit-button
                                                ?primary="${this.offset === this.limit * ((item as number) - 1)}"
                                                disabled="${this.offset === this.limit * ((item as number) - 1) || nothing}"
                                                @click="${() => {
                                                    this.offset = this.limit * ((item as number) - 1)
                                                    this.filterChanged(true)
                                                }}"
                                            >${item}</rokit-button>
                                        `
                                )}
                            </div>
                        ` : nothing}
                    </div>
                </div>

                <!-- Right: content area -->
                <div id="content-col">
                    <div class="filter-bar">
                        <div class="filter-chips">
                            ${activeChips.map(chip => html`<span class="filter-chip">${chip}</span>`)}
                        </div>
                        ${activeChips.length > 0 ? html`
                            <button class="reset-filters-btn" @click="${() => this.resetFacetFilters()}">
                                <span class="material-icons">restart_alt</span>
                                Reset Filters
                            </button>
                        ` : nothing}
                        <button class="edit-filters-btn" @click="${() => { this.filterModalOpen = true }}">
                            <span class="material-icons">tune</span>
                            ${i18n['edit_filters'] || 'Edit Filters'}
                        </button>
                    </div>
                    <div id="viewer-wrap">
                        <rdf-viewer
                            rdfSubject="${this.viewRdfSubject}"
                            rdfNamespace="${this.config.rdfNamespace}"
                            highlightSubject="${this.viewHiglightSubject}"
                            .config="${this.config}"
                            @delete="${() => { this.viewResource(null); this.filterChanged() }}"
                        ></rdf-viewer>
                    </div>
                </div>

                <!-- Hidden facets container — keeps facets in DOM for updateValues/queries to work -->
                <div id="facets-hidden">
                    ${this.facets ? Object.values(this.facets.facets).flat().map(f => html`${f}`) : nothing}
                </div>
            </div>

            <!-- Filter modal overlay -->
            ${this.filterModalOpen ? html`
                <filter-modal
                    .facets="${modalFacets}"
                    @apply="${() => { this.filterModalOpen = false; this.filterChanged() }}"
                    @cancel="${() => { this.filterModalOpen = false }}"
                ></filter-modal>
            ` : nothing}

            <!-- Add resource editor (hidden, opened programmatically) -->
            ${this.config.authWriteAccess ? html`
                <rdf-editor
                    .profiles="${this.config.profiles}"
                    rdfNamespace="${this.config.rdfNamespace}"
                    @saved="${(event: CustomEvent) => { this.filterChanged(); this.viewResource(event.detail.id) }}"
                ></rdf-editor>
            ` : nothing}

            <rokit-snackbar></rokit-snackbar>
        `
    }
}
