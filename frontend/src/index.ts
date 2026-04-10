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

/**
 * Mirror of Go's CleanStringForSolr: lowercase + replace [\/*?"<>|#:.\- ] with _.
 * Used to map a raw profile IRI to its Solr field-name prefix key in this.facets.facets.
 */
function cleanForSolr(s: string): string {
    return s.toLowerCase().replace(/[/*?"<>|#:.\- ]/g, '_')
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
    @state() resultsCollapsed = false
    @state() profileSearch = ''
    /** IRIs of all currently selected profiles (multi-select) */
    @state() selectedProfiles: string[] = []
    /** Controls which workflow step is visible */
    @state() workflowStep: 'profile' | 'explore' = 'profile'

    debounceTimeout: ReturnType<typeof setTimeout> | undefined
    private autoAdvanceTimer: ReturnType<typeof setTimeout> | undefined

    private advanceToExplore() {
        clearTimeout(this.autoAdvanceTimer)
        this.workflowStep = 'explore'
        const url = new URL(window.location.href)
        if (this.selectedProfiles.length > 0) {
            url.searchParams.set('profiles', this.selectedProfiles.join(','))
        }
        history.pushState('', '', url.toString())
        // Trigger search now that we're in explore step
        this.filterChanged()
    }

    private goBackToProfiles() {
        clearTimeout(this.autoAdvanceTimer)
        this.workflowStep = 'profile'
        this.filterModalOpen = false
        const url = new URL(window.location.href)
        url.searchParams.delete('profiles')
        history.pushState('', '', url.toString())
    }

    handleLocationChange = () => {
        // Restore profile selection from URL query param (handles back/forward)
        if (this.facets) {
            const profilesFromUrl = new URL(window.location.href).searchParams.get('profiles')
                ?.split(',').filter(Boolean) ?? []
            const same =
                profilesFromUrl.length === this.selectedProfiles.length &&
                profilesFromUrl.every(p => this.selectedProfiles.includes(p))
            if (!same) {
                const profileFacet = this.getProfileFacet()
                if (profileFacet) {
                    this.selectedProfiles = profilesFromUrl
                    profileFacet.selectedValues = profilesFromUrl
                    profileFacet.active = profilesFromUrl.length > 0
                    this.filterChanged()
                }
            }
            // Infer step from URL
            const profilesFromUrl2 = new URL(window.location.href).searchParams.get('profiles')
                ?.split(',').filter(Boolean) ?? []
            if (profilesFromUrl2.length > 0 && this.workflowStep !== 'explore') {
                this.workflowStep = 'explore'
            } else if (profilesFromUrl2.length === 0 && this.workflowStep !== 'profile') {
                this.workflowStep = 'profile'
            }
        }

        // Restore resource viewer from URL path
        const index = window.location.pathname.indexOf('/resource/')
        if (index > -1) {
            const id = window.location.pathname.substring(index + 10)
            if (id && this.config) {
                this.viewRdfSubject = this.config.rdfNamespace + id
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
        const currentUrl = new URL(window.location.href)
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
        // Always preserve the profiles query param so handleLocationChange doesn't reset selection
        const profiles = currentUrl.searchParams.get('profiles')
        if (profiles) {
            path += '?' + new URLSearchParams({ profiles }).toString()
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

            // Restore profiles from URL on page load (deep link support)
            const profilesFromUrl = new URL(window.location.href).searchParams.get('profiles')
                ?.split(',').filter(Boolean) ?? []
            if (profilesFromUrl.length > 0) {
                const profileFacet = this.getProfileFacet()
                if (profileFacet) {
                    this.selectedProfiles = profilesFromUrl
                    profileFacet.selectedValues = profilesFromUrl
                    profileFacet.active = true
                }
                // Deep link: skip profile landing step
                this.workflowStep = 'explore'
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

        const isSelected = this.selectedProfiles.includes(profileValue)
        const next = isSelected
            ? this.selectedProfiles.filter(p => p !== profileValue)
            : [...this.selectedProfiles, profileValue]

        this.selectedProfiles = next
        profileFacet.selectedValues = next
        profileFacet.active = next.length > 0
        this.offset = 0

        // If on explore step and all profiles removed, go back to profile landing
        if (this.workflowStep === 'explore' && next.length === 0) {
            this.goBackToProfiles()
            return
        }

        // Push profiles into URL so back/forward restores them
        const url = new URL(window.location.href)
        if (next.length > 0) {
            url.searchParams.set('profiles', next.join(','))
        } else {
            url.searchParams.delete('profiles')
        }
        history.pushState('', '', url.toString())

        // Auto-open filter modal only when on explore step and a NEW profile is added.
        // Never open on profile landing step (step 1).
        if (!isSelected && this.workflowStep === 'explore') {
            const cleanedKey = cleanForSolr(profileValue)
            const profileFacets = this.facets?.facets[cleanedKey] ?? []
            if (profileFacets.some(f => !(f instanceof ProfileFacet))) {
                this.filterModalOpen = true
            }
        }

        // Auto-advance from profile landing to explore after first selection (1.2s delay)
        if (!isSelected && this.workflowStep === 'profile' && next.length === 1) {
            clearTimeout(this.autoAdvanceTimer)
            this.autoAdvanceTimer = setTimeout(() => {
                this.advanceToExplore()
            }, 1200)
        }
        // Cancel auto-advance if user deselected all
        if (next.length === 0) {
            clearTimeout(this.autoAdvanceTimer)
        }

        this.filterChanged()
    }

    private removeSelectedProfile(profileValue: string) {
        this.selectProfile(profileValue)
    }

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
        this.requestUpdate()
        this.filterChanged()
    }

    private getActiveFilterChips(): { category: string; label: string; facet: Facet }[] {
        const chips: { category: string; label: string; facet: Facet }[] = []
        if (!this.facets) return chips
        for (const profile of Object.keys(this.facets.facets)) {
            for (const facet of this.facets.facets[profile]) {
                if (!facet.active) continue
                if (facet instanceof ProfileFacet) continue
                if (facet instanceof KeywordFacet && facet.selectedValue) {
                    chips.push({
                        category: facet.label || facet.indexFieldWithoutDatatype,
                        label: i18n[String(facet.selectedValue)] || String(facet.selectedValue),
                        facet,
                    })
                } else if (facet instanceof NumberRangeFacet && facet.value) {
                    chips.push({
                        category: facet.label || facet.indexFieldWithoutDatatype,
                        label: `${facet.value[0]} – ${facet.value[1]}`,
                        facet,
                    })
                }
            }
        }
        return chips
    }

    private removeFacetFilter(facet: Facet) {
        if (facet instanceof KeywordFacet) {
            facet.selectedValue = ''
        } else if (facet instanceof NumberRangeFacet) {
            facet.value = undefined
            facet.lastSelectedValue = undefined
        }
        facet.active = false
        this.offset = 0
        this.requestUpdate()
        this.filterChanged()
    }

    /**
     * Builds the landing page profile list from config.profiles (always complete),
     * augmented with doc counts from the profileFacet aggregation.
     * This ensures all profiles are shown even when a filter is active.
     */
    private getLandingProfiles(): { value: string | number; docCount: number }[] {
        const profileFacet = this.getProfileFacet()
        const countMap = new Map(
            profileFacet?.values.map(v => [String(v.value), v.docCount]) ?? []
        )
        return (this.config?.profiles ?? []).map(iri => ({
            value: iri,
            docCount: countMap.get(iri) ?? 0,
        }))
    }

    private getModalFacets(): Facet[] {
        if (!this.facets) return []
        if (this.selectedProfiles.length > 0) {
            const result: Facet[] = []
            const seen = new Set<string>()
            for (const profileIri of this.selectedProfiles) {
                const cleanedKey = cleanForSolr(profileIri)
                const profileFacets = this.facets.facets[cleanedKey] ?? []
                for (const f of profileFacets) {
                    if (!(f instanceof ProfileFacet) && !seen.has(f.indexField)) {
                        seen.add(f.indexField)
                        result.push(f)
                    }
                }
            }
            if (result.length > 0) return result
        }
        return Object.values(this.facets.facets)
            .flat()
            .filter(f => f.valid && !(f instanceof ProfileFacet))
    }

    // ─── Step 1: Profile Landing ───────────────────────────────────────────────

    private renderProfileLandingStep(allProfiles: { value: string | number; docCount: number }[]) {
        const filtered = this.profileSearch
            ? allProfiles.filter(p =>
                  (i18n[String(p.value)] || String(p.value))
                      .toLowerCase()
                      .includes(this.profileSearch.toLowerCase())
              )
            : allProfiles

        return html`
            <div class="landing-step">
                <div class="landing-hero">
                    <h1 class="landing-title">What would you like to explore?</h1>
                    <p class="landing-subtitle">Select one or more metadata profiles to get started</p>
                </div>

                <div class="landing-search-wrap">
                    <div class="landing-search-box">
                        <span class="material-icons">search</span>
                        <input
                            type="text"
                            placeholder="Filter profiles…"
                            .value="${this.profileSearch}"
                            @input="${(e: Event) => { this.profileSearch = (e.target as HTMLInputElement).value }}"
                        >
                        ${this.profileSearch ? html`
                            <button class="landing-search-clear"
                                @click="${() => { this.profileSearch = '' }}">
                                <span class="material-icons">close</span>
                            </button>
                        ` : nothing}
                    </div>
                </div>

                <div class="profile-card-grid">
                    ${filtered.map(p => {
                        const iri = String(p.value)
                        const label = i18n[iri] || iri
                        const isSelected = this.selectedProfiles.includes(iri)
                        return html`
                            <button
                                class="profile-card ${isSelected ? 'selected' : ''}"
                                @click="${() => this.selectProfile(iri)}"
                            >
                                <div class="profile-card-icon-wrap">
                                    <span class="material-icons profile-card-icon">description</span>
                                    ${isSelected ? html`
                                        <span class="profile-card-check">
                                            <span class="material-icons">check</span>
                                        </span>
                                    ` : nothing}
                                </div>
                                <div class="profile-card-name">${label}</div>
                                <div class="profile-card-badge">
                                    ${p.docCount.toLocaleString()}
                                    <span class="profile-card-badge-label"> resources</span>
                                </div>
                            </button>
                        `
                    })}
                    ${filtered.length === 0 ? html`
                        <div class="landing-no-profiles">No profiles match "${this.profileSearch}"</div>
                    ` : nothing}
                </div>

                ${this.selectedProfiles.length > 0 ? html`
                    <div class="landing-cta-bar">
                        <span class="landing-cta-hint">
                            ${this.selectedProfiles.length} profile${this.selectedProfiles.length > 1 ? 's' : ''} selected
                        </span>
                        <button class="landing-explore-btn" @click="${() => this.advanceToExplore()}">
                            Explore
                            <span class="material-icons">arrow_forward</span>
                        </button>
                    </div>
                ` : nothing}
            </div>
        `
    }

    // ─── Step 2: Context bar + two-column explore layout ──────────────────────

    private renderContextBar(activeChips: { category: string; label: string; facet: Facet }[]) {
        return html`
            <div class="context-bar">
                <button class="context-back-btn" @click="${() => this.goBackToProfiles()}">
                    <span class="material-icons">arrow_back</span>
                    <span>Change Profile</span>
                </button>

                <div class="context-bar-divider"></div>

                <div class="context-profile-chips">
                    ${this.selectedProfiles.map(iri => html`
                        <span class="context-profile-chip">
                            <span class="material-icons">description</span>
                            <span>${i18n[iri] || iri}</span>
                            <button class="chip-remove"
                                title="Remove profile"
                                @click="${(e: Event) => {
                                    e.stopPropagation()
                                    this.removeSelectedProfile(iri)
                                }}">
                                <span class="material-icons">close</span>
                            </button>
                        </span>
                    `)}
                </div>

                <div class="context-bar-divider"></div>

                <div class="context-search-box">
                    <span class="material-icons">search</span>
                    <input
                        type="text"
                        placeholder="${i18n['fulltextsearch'] || 'Search metadata…'}"
                        .value="${this.searchTerm}"
                        @input="${(e: Event) => {
                            this.searchTerm = (e.target as HTMLInputElement).value
                            this.filterChanged()
                        }}"
                    >
                    ${this.searchTerm ? html`
                        <button class="context-search-clear"
                            @click="${() => { this.searchTerm = ''; this.filterChanged() }}">
                            <span class="material-icons">close</span>
                        </button>
                    ` : nothing}
                </div>

                <button class="edit-filters-btn" @click="${() => { this.filterModalOpen = true }}">
                    <span class="material-icons">tune</span>
                    ${i18n['edit_filters'] || 'Edit Filters'}
                </button>

                ${activeChips.length > 0 ? html`
                    <div class="context-filter-chips">
                        ${activeChips.map(chip => html`
                            <span class="filter-chip">
                                <span class="chip-category">${chip.category}:</span>
                                ${chip.label}
                                <button class="chip-remove" title="Remove this filter"
                                    @click="${() => this.removeFacetFilter(chip.facet)}">
                                    <span class="material-icons">close</span>
                                </button>
                            </span>
                        `)}
                        <button class="reset-filters-btn" @click="${() => this.resetFacetFilters()}">
                            <span class="material-icons">restart_alt</span>
                            Reset
                        </button>
                    </div>
                ` : nothing}
            </div>
        `
    }

    private renderExploreStep(activeChips: { category: string; label: string; facet: Facet }[]) {
        return html`
            <div class="explore-step">
                ${this.renderContextBar(activeChips)}
                <div class="explore-columns">
                    <div id="results-col" class="${this.resultsCollapsed ? 'collapsed' : ''}">
                        ${this.renderResults(this.searchHits)}
                    </div>
                    <div id="content-col">
                        <div id="viewer-wrap">
                            <rdf-viewer
                                rdfSubject="${this.viewRdfSubject}"
                                rdfNamespace="${this.config!.rdfNamespace}"
                                highlightSubject="${this.viewHiglightSubject}"
                                .config="${this.config}"
                                @delete="${() => { this.viewResource(null); this.filterChanged() }}"
                            ></rdf-viewer>
                        </div>
                    </div>
                </div>
            </div>
        `
    }

    private renderResults(filteredHits: SearchDocument[]) {
        if (this.resultsCollapsed) {
            return html`
                <div class="collapsed-strip">
                    <button class="strip-toggle" title="Expand results"
                        @click="${() => { this.resultsCollapsed = false }}">
                        <span class="material-icons">keyboard_double_arrow_right</span>
                    </button>
                    <span class="strip-center-label">Results</span>
                </div>
            `
        }

        return html`
            <div class="results-header">
                <h2>${i18n['results'] ? i18n['results'].split(' ')[0] : 'Results'}</h2>
                <button class="results-collapse-btn" title="Collapse results"
                    @click="${() => { this.resultsCollapsed = true }}">
                    <span class="material-icons">keyboard_double_arrow_left</span>
                </button>
            </div>
            <div class="results-count">${this.totalHits} ${i18n['results'] || 'results'}</div>
            <div class="result-cards">
                ${filteredHits.length === 0 && this.totalHits === 0 ? html`
                    <div class="no-results">${i18n['noresults'] || 'No results found'}</div>
                ` : filteredHits.map(hit => html`
                    <button
                        class="result-card ${(hit.id === this.viewHiglightSubject || (!this.viewHiglightSubject && hit.id === this.viewRdfSubject)) ? 'active' : ''}"
                        @click="${() => this.viewResource(hit)}"
                    >
                        <div class="result-title">${hit.label?.length ? hit.label.join(', ') : hit.id}</div>
                        <div class="result-meta">
                            ${i18n['shape'] || 'Profile'}:
                            <span>${hit.shape?.length ? (i18n[hit.shape[0]] || hit.shape[0]) : 'No profile'}</span>
                        </div>
                        ${hit.lastModified ? html`
                            <div class="result-meta">
                                ${i18n['last_modified'] || 'Last modified'}:
                                <span>${new Date(hit.lastModified).toDateString()}</span>
                            </div>
                        ` : nothing}
                    </button>
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
        `
    }

    render() {
        if (!this.config) return html`<rokit-snackbar></rokit-snackbar>`

        const allProfiles = this.getLandingProfiles()
        const activeChips = this.getActiveFilterChips()
        const modalFacets = this.getModalFacets()

        return html`
            <layout-header @reset-filters="${() => {}}">
                <div id="header-buttons">
                    ${!this.config.authWriteAccess ? nothing : html`
                        <rokit-button primary @click="${() => this.openEditor()}">
                            <span class="material-icons">add</span>${i18n['add_resource']}
                        </rokit-button>
                    `}
                    ${!this.config.authEnabled || this.config.authUser ? nothing : html`
                        <rokit-button primary href="${APP_PATH}oauth2/sign_in">
                            <span class="material-icons">login</span>${i18n['sign_in']}
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

                <!-- Horizontal slide container: both steps side-by-side at 200% total width -->
                <div class="workflow-slider ${this.workflowStep === 'explore' ? 'at-explore' : ''}">
                    <!-- Step 1: Profile Landing -->
                    <div class="workflow-panel workflow-panel-profile">
                        ${this.renderProfileLandingStep(allProfiles)}
                    </div>
                    <!-- Step 2: Explore (results + viewer) -->
                    <div class="workflow-panel workflow-panel-explore">
                        ${this.renderExploreStep(activeChips)}
                    </div>
                </div>

                <!-- Hidden facets: kept outside slider so DOM is never destroyed during transitions -->
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

            <!-- Add resource editor -->
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
