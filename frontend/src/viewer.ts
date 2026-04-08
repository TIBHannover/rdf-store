import { customElement, property, state } from 'lit/decorators.js'
import { LitElement, PropertyValues, css, html, nothing } from 'lit'
import '@ulb-darmstadt/shacl-form/plugins/leaflet.js'
import { BACKEND_URL } from './constants'
import { globalStyles } from './styles'
import './graph'
import { i18n } from './i18n'
import { showSnackbarMessage } from '@ro-kit/ui-widgets'
import { ShaclForm } from '@ulb-darmstadt/shacl-form'
import { Config } from '.'
import { resourceLinkProvider } from './editor'

@customElement('rdf-viewer')
export class Viewer extends LitElement {
    static styles = [globalStyles, css`
        :host {
            position: relative;
            background: #fff;
            display: flex;
            flex-direction: column;
            flex: 1;
            overflow: hidden;
        }
        .main {
            display: flex;
            flex-direction: column;
            flex-grow: 1;
            overflow: hidden;
        }
        .main.detail-view {
            overflow-y: auto;
        }
        .header {
            display: flex;
            align-items: center;
            border-bottom: 1px solid #E5E7EB;
            padding: 0 16px;
            background: #fff;
            flex-shrink: 0;
            min-height: 44px;
        }
        .tabs { display: flex; align-items: flex-end; gap: 0; flex: 1; height: 100%; }
        .tab-btn {
            display: inline-flex;
            align-items: center;
            padding: 12px 16px 10px;
            border: none;
            background: transparent;
            font-size: 13px;
            font-family: "Roboto", sans-serif;
            color: #6B7280;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
            transition: color 0.15s, border-color 0.15s;
            white-space: nowrap;
        }
        .tab-btn:hover { color: #374151; }
        .tab-btn.active { color: #2563EB; border-bottom-color: #2563EB; font-weight: 500; }
        .spacer { flex-grow: 1; }
        .header-actions { display: flex; align-items: center; gap: 4px; }
        .action-btn {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 5px 10px;
            border: 1px solid #E5E7EB;
            border-radius: 6px;
            background: #fff;
            font-size: 12px;
            font-family: "Roboto", sans-serif;
            color: #374151;
            cursor: pointer;
            white-space: nowrap;
        }
        .action-btn:hover { background: #F9FAFB; }
        .action-btn .material-icons { font-size: 15px; }
        .action-btn-danger { color: #DC2626; border-color: #FECACA; }
        .action-btn-danger:hover { background: #FEF2F2; }
        shacl-form, rdf-graph { flex-grow: 1; --shacl-bg: transparent; }
        .placeholder {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-grow: 1;
            color: #9CA3AF;
            font-size: 14px;
            flex-direction: column;
            gap: 8px;
        }
        .placeholder .material-icons { font-size: 36px; color: #D1D5DB; }
        #delete-button { --rokit-light-background-color: #FEE; color: #F00; }
    `]
    @property()
    rdfSubject = ''
    @property()
    rdfNamespace = ''
    @property()
    highlightSubject = ''
    @property()
    config?: Config
    @state()
    editable = false
    @state()
    rdf = ''
    @state()
    rdfWithLinked = ''
    @state()
    graphView = true
    @state()
    editMode = false
    @state()
    saving = false
    private loadTimeout?: number

    updated(changedProperties: PropertyValues) {
        if ((changedProperties.has('rdfSubject') || changedProperties.has('highlightSubject')) && this.rdfSubject) {
            this.highlightSubject = this.highlightSubject || this.rdfSubject
            this.editMode = false
            this.editable = false
            this.load()
        }
        if (changedProperties.has('graphView') && !this.graphView) {
            (this.shadowRoot!.querySelector('shacl-form') as ShaclForm)?.setResourceLinkProvider(resourceLinkProvider)
        }
    }

    private async load() {
        window.clearTimeout(this.loadTimeout)
        if (!this.rdfSubject) {
            return
        }
        const subject = this.rdfSubject
        this.loadTimeout = window.setTimeout(async () => {
            if (this.rdfSubject !== subject) {
                return
            }
            try {
                let resp = await fetch(`${BACKEND_URL}/resource/${encodeURIComponent(subject)}`)
                if (resp.ok) {
                    this.rdf = await resp.text()
                    // check if editable
                    const creator = resp.headers.get('X-Creator')
                    this.editable = (!this.config?.authEnabled || (this.config?.authUser && this.config?.authUser === creator)) ? true : false
                } else {
                    throw new Error(`${i18n['noresults']}, ${resp.statusText}`)
                }
                resp = await fetch(`${BACKEND_URL}/resource/${encodeURIComponent(subject)}?includeLinked`)
                if (resp.ok) {
                    this.rdfWithLinked = await resp.text()
                } else {
                    throw new Error(`${i18n['noresults']}, ${resp.statusText}`)
                }
            } catch(e) {
                showSnackbarMessage({message: '' + e, ttl: 0, cssClass: 'error' })
            }
        })
    }

    private export() {
        if (this.rdf) {
          const link = document.createElement('a')
          link.href = window.URL.createObjectURL(new Blob([this.rdf], { type: "text/turtle" }))
          link.download = 'metadata.ttl'
          link.click()
        }
    }

    private async save() {
        const form = this.shadowRoot?.querySelector<ShaclForm>('#form')
        if (!form) {
            showSnackbarMessage({message: 'form not found', cssClass: 'error' })
            return
        }
        if (form.form.reportValidity()) {
            const report = await form.validate() as any
            const ttl = form.serialize()
            if (report.conforms) {
                this.saving = true
                const formData = new URLSearchParams()
                formData.append('ttl', ttl)
                try {
                    const resp = await fetch(`${BACKEND_URL}/resource/${encodeURIComponent(this.rdfSubject)}`, { method: 'PUT', cache: 'no-cache', body: formData })
                    if (!resp.ok) {
                        let message = i18n['resource_save_failed'] + '<br><small>Status: ' + resp.status + '</small>'
                        const contentType = resp.headers.get('content-type')
                        if (contentType?.includes('application/json')) {
                            const data = await resp.json()
                            if (data.error) {
                                message += '<br><small>' + i18n['error'] + ': ' + data.error + '</small>'
                            }
                        }
                        showSnackbarMessage({message: message, ttl: 0, cssClass: 'error' })
                    } else {
                        showSnackbarMessage({ message: i18n['resource_save_succeeded'], cssClass: 'success' })
                        this.editMode = false
                        this.load()
                    }
                } catch(e) {
                    showSnackbarMessage({message: '' + e, ttl: 0, cssClass: 'error' })
                } finally {
                    this.saving = false
                }
            } else {
                console.log(ttl)
                console.warn(report)
            }
        }
    }

    private async delete() {
        try {
            const url = BACKEND_URL + '/resource/' + encodeURIComponent(this.rdfSubject)
            const resp = await fetch(url, { method: 'DELETE', cache: 'no-cache' })
            if (!resp.ok) {
                let message = i18n['resource_delete_failed'] + '<br><small>Status: ' + resp.status + '</small>'
                const contentType = resp.headers.get('content-type')
                if (contentType?.includes('application/json')) {
                    const data = await resp.json()
                    if (data.error) {
                        message += '<br><small>' + i18n['error'] + ': ' + data.error + '</small>'
                    }
                }
                throw(message)
            }
            this.rdfSubject = ''
            this.highlightSubject = ''
            this.rdf = ''
            this.editMode = false
            showSnackbarMessage({ message: i18n['resource_delete_succeeded'], cssClass: 'success' })
            this.dispatchEvent(new Event('delete'))
        } catch(e) {
            showSnackbarMessage({message: '' + e, ttl: 0, cssClass: 'error' })
        }
    }

    render() {
        return this.rdf ? html`
            <div class="header">
            ${this.editMode ? html`
                <div class="tabs">
                    <button class="action-btn action-btn-danger" @click="${this.delete}" ?disabled="${this.saving}">
                        <span class="material-icons">delete</span>${i18n['delete']}
                    </button>
                </div>
                <div class="spacer"></div>
                <div class="header-actions">
                    <button class="action-btn" @click="${() => { this.editMode = false }}" ?disabled="${this.saving}">
                        ${i18n['cancel']}
                    </button>
                    <button class="action-btn" style="background:#2563EB;color:#fff;border-color:#2563EB;" @click="${this.save}" ?disabled="${this.saving}">
                        <span class="material-icons">cloud_upload</span>${i18n['save']}
                    </button>
                </div>
            ` : html`
                <div class="tabs">
                    <button
                        class="tab-btn ${this.graphView ? 'active' : ''}"
                        @click="${() => { this.graphView = true }}"
                    >${i18n['graph_view'] || 'Graph View'}</button>
                    <button
                        class="tab-btn ${!this.graphView ? 'active' : ''}"
                        @click="${() => { this.graphView = false }}"
                    >${i18n['detail_view'] || 'Node Detail'}</button>
                </div>
                <div class="spacer"></div>
                <div class="header-actions">
                    ${!this.editable ? nothing : html`
                        <button class="action-btn" @click="${() => { this.editMode = true; this.graphView = false }}">
                            <span class="material-icons">edit</span>${i18n['edit']}
                        </button>
                    `}
                    <button class="action-btn" @click="${() => { this.export() }}">
                        <span class="material-icons">download</span>${i18n['export'] || 'Export'}
                    </button>
                </div>
            `}
            </div>
            <div class="main ${this.graphView ? '' : 'detail-view'}">
            ${this.graphView ? html`
                <rdf-graph rdfSubject="${this.rdfSubject}" highlightSubject="${this.highlightSubject}" rdf="${this.rdfWithLinked}"></rdf-graph>
            ` : html`
                <shacl-form
                    id="form"
                    data-values="${this.rdf}"
                    data-values-subject="${this.rdfSubject}"
                    data-values-namespace="${this.rdfNamespace}"
                    data-proxy="${BACKEND_URL}/rdfproxy?url="
                    data-hierarchy-colors
                    ?data-view=${!this.editMode}
                    data-show-root-shape-label
                ></shacl-form>
            `}
            </div>
        ` : html`
            <div class="placeholder">
                <span class="material-icons">account_tree</span>
                ${i18n['click_hit_to_view'] || 'Select a result to view details'}
            </div>
        `
    }
}
