import { customElement, property, state } from 'lit/decorators.js'
import { LitElement, PropertyValues, css, html, nothing } from 'lit'
import '@ulb-darmstadt/shacl-form/plugins/leaflet.js'
import { BACKEND_URL } from './constants'
import { globalStyles } from './styles'
import './graph'
import { RdfGraph } from './graph'
import { i18n } from './i18n'
import { showSnackbarMessage } from '@ro-kit/ui-widgets'
import { ShaclForm } from '@ulb-darmstadt/shacl-form'
import { Config } from '.'
import { resourceLinkProvider } from './editor'

@customElement('rdf-viewer')
export class Viewer extends LitElement {
    static styles = [globalStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            flex: 1;
            overflow: hidden;
            background: #fcf8f9;
        }

        /* Padded wrapper around the white card */
        .exploration-panel {
            flex: 1;
            padding: 20px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 0;
        }

        /* White rounded card — holds graph or detail content */
        .exploration-card {
            flex: 1;
            background: white;
            border-radius: 16px;
            border: 1px solid #e4e2e5;
            box-shadow: 0 2px 12px rgba(50,50,53,0.06);
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        /* Graph fills the card */
        rdf-graph { flex: 1; --shacl-bg: transparent; }

        /* Floating button groups */
        .graph-controls {
            position: absolute;
            bottom: 16px;
            right: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 10;
        }
        .detail-controls {
            position: absolute;
            top: 16px;
            right: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 20;
        }
        .edit-btns-right {
            position: absolute;
            top: 16px;
            right: 16px;
            display: flex;
            gap: 8px;
            z-index: 20;
        }
        .edit-btns-left {
            position: absolute;
            top: 16px;
            left: 16px;
            z-index: 20;
        }

        /* Icon-only floating button */
        .ctrl-btn {
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
            transition: all 0.12s;
            padding: 0;
            font-family: inherit;
        }
        .ctrl-btn:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.16); transform: translateY(-1px); }
        .ctrl-btn:active { transform: translateY(0); }
        .ctrl-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
        .ctrl-btn .material-icons { font-size: 20px; }
        .ctrl-btn-primary { background: #005db5; color: #f6f7ff; }
        .ctrl-btn-primary:hover { background: #0052a0; }
        .ctrl-btn-white { background: white; color: #5f5f61; border: 1px solid #e4e2e5; }
        .ctrl-btn-white:hover { color: #323235; background: #f6f3f4; }
        .ctrl-btn-danger { background: white; color: #dc2626; border: 1px solid #fecaca; }
        .ctrl-btn-danger:hover { background: #fef2f2; }

        /* Text + icon buttons for Save / Cancel */
        .text-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            height: 40px;
            padding: 0 16px;
            border-radius: 8px;
            font-size: 13px;
            font-family: inherit;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: all 0.12s;
            border: none;
        }
        .text-btn:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); transform: translateY(-1px); }
        .text-btn:active { transform: translateY(0); }
        .text-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
        .text-btn .material-icons { font-size: 16px; }
        .text-btn-primary { background: #005db5; color: #f6f7ff; }
        .text-btn-primary:hover { background: #0052a0; }
        .text-btn-ghost { background: white; color: #5f5f61; border: 1px solid #e4e2e5; }
        .text-btn-ghost:hover { background: #f6f3f4; color: #323235; }

        /* Scrollable detail form inside card */
        .detail-scroll {
            flex: 1;
            overflow-y: auto;
            padding: 20px 24px;
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        .detail-scroll::-webkit-scrollbar { display: none; }
        shacl-form { --shacl-bg: transparent; }

        /* Placeholder when no resource is selected */
        .placeholder {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            flex: 1;
            gap: 14px;
            color: #b3b1b4;
        }
        .placeholder-icon {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            background: #f0edef;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .placeholder-icon .material-icons { font-size: 36px; color: #b3b1b4; }
        .placeholder-title { font-size: 15px; font-weight: 700; color: #5f5f61; margin: 0; }
        .placeholder p { margin: 0; font-size: 13px; text-align: center; max-width: 240px; }
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

    private get graphEl(): RdfGraph | null {
        return this.shadowRoot?.querySelector('rdf-graph') as RdfGraph | null
    }

    updated(changedProperties: PropertyValues) {
        if ((changedProperties.has('rdfSubject') || changedProperties.has('highlightSubject')) && this.rdfSubject) {
            this.highlightSubject = this.highlightSubject || this.rdfSubject
            this.editMode = false
            this.editable = false
            this.graphView = true
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
        if (!this.rdf) {
            return html`
                <div class="placeholder">
                    <div class="placeholder-icon">
                        <span class="material-icons">account_tree</span>
                    </div>
                    <span class="placeholder-title">Configure Exploration</span>
                    <p>${i18n['click_hit_to_view'] || 'Select a metadata profile, apply filters, then click a result to explore.'}</p>
                </div>
            `
        }

        return html`
            <div class="exploration-panel">
                <div class="exploration-card">
                    ${this.graphView ? this.renderGraphView() : this.renderDetailView()}
                </div>
            </div>
        `
    }

    private renderGraphView() {
        return html`
            <rdf-graph
                rdfSubject="${this.rdfSubject}"
                highlightSubject="${this.highlightSubject}"
                rdf="${this.rdfWithLinked}"
            ></rdf-graph>

            <!-- Floating controls — bottom-right of card, matching demo -->
            <div class="graph-controls">
                <button class="ctrl-btn ctrl-btn-primary"
                    title="${i18n['detail_view'] || 'Node Detail'}"
                    @click="${() => { this.graphView = false }}">
                    <span class="material-icons">description</span>
                </button>
                <button class="ctrl-btn ctrl-btn-white" title="Zoom in"
                    @click="${() => this.graphEl?.zoomIn()}">
                    <span class="material-icons">add</span>
                </button>
                <button class="ctrl-btn ctrl-btn-white" title="Zoom out"
                    @click="${() => this.graphEl?.zoomOut()}">
                    <span class="material-icons">remove</span>
                </button>
                <button class="ctrl-btn ctrl-btn-white" title="Reset view"
                    @click="${() => this.graphEl?.resetZoom()}">
                    <span class="material-icons">refresh</span>
                </button>
            </div>
        `
    }

    private renderDetailView() {
        if (this.editMode) {
            return html`
                <!-- Delete — top-left -->
                <div class="edit-btns-left">
                    <button class="ctrl-btn ctrl-btn-danger" title="${i18n['delete'] || 'Delete'}"
                        @click="${this.delete}" ?disabled="${this.saving}">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
                <!-- Cancel / Save — top-right -->
                <div class="edit-btns-right">
                    <button class="text-btn text-btn-ghost"
                        @click="${() => { this.editMode = false }}" ?disabled="${this.saving}">
                        ${i18n['cancel'] || 'Cancel'}
                    </button>
                    <button class="text-btn text-btn-primary"
                        @click="${this.save}" ?disabled="${this.saving}">
                        <span class="material-icons">cloud_upload</span>
                        ${i18n['save'] || 'Save'}
                    </button>
                </div>
                <div class="detail-scroll">
                    <shacl-form
                        id="form"
                        data-values="${this.rdf}"
                        data-values-subject="${this.rdfSubject}"
                        data-values-namespace="${this.rdfNamespace}"
                        data-proxy="${BACKEND_URL}/rdfproxy?url="
                        data-hierarchy-colors
                        data-show-root-shape-label
                    ></shacl-form>
                </div>
            `
        }

        return html`
            <!-- Floating controls — top-right: graph toggle, edit, export -->
            <div class="detail-controls">
                <button class="ctrl-btn ctrl-btn-primary"
                    title="${i18n['graph_view'] || 'Graph View'}"
                    @click="${() => { this.graphView = true }}">
                    <span class="material-icons">hub</span>
                </button>
                ${!this.editable ? nothing : html`
                    <button class="ctrl-btn ctrl-btn-white"
                        title="${i18n['edit'] || 'Edit'}"
                        @click="${() => { this.editMode = true }}">
                        <span class="material-icons">edit</span>
                    </button>
                `}
                <button class="ctrl-btn ctrl-btn-white"
                    title="${i18n['export'] || 'Export'}"
                    @click="${() => { this.export() }}">
                    <span class="material-icons">download</span>
                </button>
            </div>
            <!-- Scrollable detail content -->
            <div class="detail-scroll">
                <shacl-form
                    id="form"
                    data-values="${this.rdf}"
                    data-values-subject="${this.rdfSubject}"
                    data-values-namespace="${this.rdfNamespace}"
                    data-proxy="${BACKEND_URL}/rdfproxy?url="
                    data-hierarchy-colors
                    data-view
                    data-show-root-shape-label
                ></shacl-form>
            </div>
        `
    }
}
