import { LitElement, css, html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { Facet } from './facets/base'
import { KeywordFacet } from './facets/keyword'
import { NumberRangeFacet } from './facets/number-range'
import { i18n } from './i18n'
import { globalStyles } from './styles'

@customElement('filter-modal')
export class FilterModal extends LitElement {
    static styles = [globalStyles, css`
        :host {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
        }

        /* Backdrop — matches demo's bg-on-surface/20 backdrop-blur-sm */
        .overlay {
            position: absolute;
            inset: 0;
            background: rgba(50, 50, 53, 0.2);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        }

        /* Modal — matches demo's max-w-md bg-white rounded-2xl shadow-2xl */
        .modal {
            position: relative;
            background: #ffffff;
            border-radius: 16px;
            width: 100%;
            max-width: 440px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            box-shadow: 0 25px 60px rgba(0,0,0,0.2);
            overflow: hidden;
            animation: modal-in 0.18s ease;
        }
        @keyframes modal-in {
            from { opacity: 0; transform: scale(0.95) translateY(20px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
        }

        /* Header — matches demo's p-6 border-b border-surface-container */
        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 24px 24px 20px;
            border-bottom: 1px solid #f0edef;
            flex-shrink: 0;
        }
        .modal-title {
            font-size: 16px;
            font-weight: 700;
            color: #323235;
            letter-spacing: -0.01em;
        }
        .close-btn {
            width: 28px;
            height: 28px;
            border: none;
            background: transparent;
            cursor: pointer;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #7b7a7d;
            transition: background 0.1s, color 0.1s;
            padding: 0;
            font-family: inherit;
        }
        .close-btn:hover { background: #f6f3f4; color: #323235; }
        .close-btn .material-icons { font-size: 20px; }

        /* Body — matches demo's p-6 overflow-y-auto no-scrollbar */
        .modal-body {
            flex: 1;
            overflow-y: auto;
            padding: 8px 24px 16px;
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
        .modal-body::-webkit-scrollbar { display: none; }

        /* Section label — matches demo's text-xs font-bold text-outline-variant uppercase tracking-widest mb-4 */
        .section-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #b3b1b4;
            margin: 20px 0 12px;
        }

        /* Accordion — matches demo's FilterAccordion */
        .accordion-item { margin-bottom: 6px; }

        .accordion-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            background: transparent;
            border: none;
            padding: 10px 0;
            cursor: pointer;
            text-align: left;
            font-family: inherit;
        }
        .accordion-title {
            font-size: 13px;
            font-weight: 600;
            color: #323235;
            transition: color 0.12s;
        }
        .accordion-header.open .accordion-title { color: #005db5; }
        .accordion-header:hover .accordion-title { color: #005db5; }

        /* Chevron icon — rotates on open */
        .accordion-icon {
            font-size: 18px !important;
            color: #7b7a7d;
            transition: transform 0.2s ease;
            flex-shrink: 0;
        }
        .accordion-icon.open { transform: rotate(180deg); }

        /* Body panel — CSS transition, matches demo's AnimatePresence height animation */
        .accordion-body {
            overflow: hidden;
            max-height: 0;
            opacity: 0;
            transition: max-height 0.22s ease, opacity 0.18s ease;
        }
        .accordion-body.open { max-height: 300px; opacity: 1; }

        /* Inner content — matches demo's p-3 bg-surface-container-low rounded-lg space-y-3 */
        .accordion-body-inner {
            padding: 10px 12px 14px;
            background: #f6f3f4;
            border-radius: 8px;
            margin-bottom: 6px;
        }

        /* Form inputs */
        select {
            width: 100%;
            padding: 9px 12px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-family: inherit;
            color: #323235;
            background: white;
            cursor: pointer;
            appearance: auto;
            outline: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.07);
        }
        select:focus { outline: 2px solid #005db5; outline-offset: 1px; }

        .range-inputs { display: flex; align-items: center; gap: 8px; }
        .range-inputs input {
            flex: 1;
            padding: 9px 12px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-family: inherit;
            color: #323235;
            background: white;
            outline: none;
            box-shadow: 0 1px 3px rgba(0,0,0,0.07);
        }
        .range-inputs input:focus { outline: 2px solid #005db5; outline-offset: 1px; }
        .range-sep { color: #7b7a7d; font-size: 13px; flex-shrink: 0; }

        /* No filters empty state */
        .no-filters {
            text-align: center;
            color: #b3b1b4;
            font-size: 13px;
            padding: 32px 0;
            line-height: 1.7;
        }

        /* Footer — matches demo's p-6 border-t border-surface-container flex gap-3 */
        .modal-footer {
            display: flex;
            gap: 10px;
            padding: 16px 24px 24px;
            border-top: 1px solid #f0edef;
            flex-shrink: 0;
        }
        /* Cancel — matches demo's flex-1 text-on-surface-variant hover:bg-surface-container */
        .btn-cancel {
            flex: 1;
            padding: 11px 16px;
            border: none;
            border-radius: 10px;
            background: transparent;
            font-size: 13px;
            font-family: inherit;
            font-weight: 500;
            cursor: pointer;
            color: #5f5f61;
            transition: background 0.1s;
        }
        .btn-cancel:hover { background: #f0edef; }
        /* Apply — matches demo's flex-1 bg-primary text-on-primary */
        .btn-apply {
            flex: 1;
            padding: 11px 16px;
            border: none;
            border-radius: 10px;
            background: #005db5;
            color: #f6f7ff;
            font-size: 13px;
            font-family: inherit;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.1s;
            box-shadow: 0 1px 4px rgba(0,93,181,0.3);
        }
        .btn-apply:hover { background: #0052a0; }
    `]

    @property({ attribute: false })
    facets: Facet[] = []

    @state() private localValues: Map<string, any> = new Map()
    @state() private expanded: Set<string> = new Set()

    updated(changed: Map<string, unknown>) {
        if (changed.has('facets')) {
            // Sync local values from facet state
            const vals = new Map<string, any>()
            for (const facet of this.facets) {
                if (facet instanceof KeywordFacet) {
                    vals.set(facet.indexField, facet.selectedValue || '')
                } else if (facet instanceof NumberRangeFacet) {
                    vals.set(facet.indexField, facet.value ? [...facet.value] : null)
                }
            }
            this.localValues = vals
            // All accordion groups open by default (matching demo)
            this.expanded = new Set(this.facets.map(f => f.indexField))
        }
    }

    private toggleExpand(field: string) {
        const next = new Set(this.expanded)
        if (next.has(field)) next.delete(field)
        else next.add(field)
        this.expanded = next
    }

    private apply() {
        for (const facet of this.facets) {
            const val = this.localValues.get(facet.indexField)
            if (facet instanceof KeywordFacet) {
                facet.selectedValue = val || ''
                facet.active = !!(val && String(val).length > 0)
            } else if (facet instanceof NumberRangeFacet) {
                if (val && Array.isArray(val) && val.length === 2 && !isNaN(val[0]) && !isNaN(val[1])) {
                    facet.lastSelectedValue = val
                    facet.value = val
                } else {
                    facet.lastSelectedValue = undefined
                    facet.value = undefined
                }
                facet.updateActive()
            }
        }
        this.dispatchEvent(new CustomEvent('apply', { bubbles: true, composed: true }))
    }

    private close() {
        this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }))
    }

    private renderFacetControl(facet: Facet) {
        if (facet instanceof KeywordFacet) {
            const currentVal = this.localValues.get(facet.indexField) || ''
            return html`
                <select @change="${(e: Event) => {
                    const newVals = new Map(this.localValues)
                    newVals.set(facet.indexField, (e.target as HTMLSelectElement).value)
                    this.localValues = newVals
                }}">
                    <option value="">All ${facet.label || 'Values'}</option>
                    ${facet.values.map(v => html`
                        <option value="${v.value}" ?selected="${v.value === currentVal}">
                            ${i18n[String(v.value)] || v.value}
                        </option>
                    `)}
                </select>
            `
        }
        if (facet instanceof NumberRangeFacet) {
            const val = this.localValues.get(facet.indexField)
            return html`
                <div class="range-inputs">
                    <input
                        type="number"
                        placeholder="${facet.min ?? 'Min'}"
                        .value="${val?.[0] != null ? String(val[0]) : ''}"
                        @input="${(e: Event) => {
                            const newVals = new Map(this.localValues)
                            const cur = newVals.get(facet.indexField) || [facet.min, facet.max]
                            newVals.set(facet.indexField, [(e.target as HTMLInputElement).valueAsNumber, cur[1]])
                            this.localValues = newVals
                        }}"
                    >
                    <span class="range-sep">to</span>
                    <input
                        type="number"
                        placeholder="${facet.max ?? 'Max'}"
                        .value="${val?.[1] != null ? String(val[1]) : ''}"
                        @input="${(e: Event) => {
                            const newVals = new Map(this.localValues)
                            const cur = newVals.get(facet.indexField) || [facet.min, facet.max]
                            newVals.set(facet.indexField, [cur[0], (e.target as HTMLInputElement).valueAsNumber])
                            this.localValues = newVals
                        }}"
                    >
                </div>
            `
        }
        return nothing
    }

    render() {
        const isOpen = (field: string) => this.expanded.has(field)

        return html`
            <div class="overlay" @click="${this.close}"></div>
            <div class="modal" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <span class="modal-title">Configure Exploration Filters</span>
                    <button class="close-btn" @click="${this.close}" aria-label="Close">
                        <span class="material-icons">close</span>
                    </button>
                </div>

                <div class="modal-body">
                    ${this.facets.length === 0 ? html`
                        <div class="no-filters">
                            No filters available.<br>Select a profile from the sidebar first.
                        </div>
                    ` : html`
                        <p class="section-label">Filter Parameters</p>
                        ${this.facets.map(facet => html`
                            <div class="accordion-item">
                                <button
                                    class="accordion-header ${isOpen(facet.indexField) ? 'open' : ''}"
                                    @click="${() => this.toggleExpand(facet.indexField)}"
                                >
                                    <span class="accordion-title">${facet.label || facet.indexFieldWithoutDatatype}</span>
                                    <span class="material-icons accordion-icon ${isOpen(facet.indexField) ? 'open' : ''}">
                                        expand_more
                                    </span>
                                </button>
                                <div class="accordion-body ${isOpen(facet.indexField) ? 'open' : ''}">
                                    <div class="accordion-body-inner">
                                        ${this.renderFacetControl(facet)}
                                    </div>
                                </div>
                            </div>
                        `)}
                    `}
                </div>

                <div class="modal-footer">
                    <button class="btn-cancel" @click="${this.close}">Cancel</button>
                    <button class="btn-apply" @click="${this.apply}">Apply Filters</button>
                </div>
            </div>
        `
    }
}
