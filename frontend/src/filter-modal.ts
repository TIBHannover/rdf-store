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
        }
        .overlay {
            position: absolute;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
        }
        .modal {
            position: relative;
            background: #fff;
            border-radius: 12px;
            width: 500px;
            max-width: 90vw;
            max-height: 80vh;
            overflow-y: auto;
            padding: 24px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.25);
        }
        .modal-header {
            display: flex;
            align-items: center;
            margin-bottom: 24px;
        }
        .modal-title {
            font-size: 16px;
            font-weight: 600;
            color: #111827;
            flex: 1;
        }
        .close-btn {
            border: none;
            background: transparent;
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 16px;
            color: #6B7280;
            line-height: 1;
            font-family: inherit;
        }
        .close-btn:hover { background: #F3F4F6; }
        .filter-field { margin-bottom: 18px; }
        .field-label {
            display: block;
            font-size: 12px;
            font-weight: 500;
            color: #2563EB;
            margin-bottom: 6px;
            letter-spacing: 0.01em;
        }
        select {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid #D1D5DB;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
            color: #374151;
            background: #fff;
            cursor: pointer;
            appearance: auto;
        }
        select:focus { outline: 2px solid #2563EB; outline-offset: 1px; }
        .range-inputs {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .range-inputs input {
            flex: 1;
            padding: 8px 10px;
            border: 1px solid #D1D5DB;
            border-radius: 6px;
            font-size: 14px;
            font-family: inherit;
            color: #374151;
        }
        .range-inputs input:focus { outline: 2px solid #2563EB; outline-offset: 1px; }
        .range-inputs span { color: #6B7280; font-size: 13px; }
        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid #E5E7EB;
        }
        .btn-cancel {
            padding: 8px 18px;
            border: 1px solid #D1D5DB;
            border-radius: 8px;
            background: #fff;
            font-size: 14px;
            font-family: inherit;
            cursor: pointer;
            color: #374151;
        }
        .btn-cancel:hover { background: #F9FAFB; }
        .btn-apply {
            padding: 8px 20px;
            border: none;
            border-radius: 8px;
            background: #2563EB;
            color: #fff;
            font-size: 14px;
            font-family: inherit;
            font-weight: 500;
            cursor: pointer;
        }
        .btn-apply:hover { background: #1D4ED8; }
        .no-filters {
            text-align: center;
            color: #9CA3AF;
            font-size: 14px;
            padding: 20px 0;
        }
    `]

    @property({ attribute: false })
    facets: Facet[] = []

    @state()
    private localValues: Map<string, any> = new Map()

    updated(changed: Map<string, unknown>) {
        if (changed.has('facets')) {
            const vals = new Map<string, any>()
            for (const facet of this.facets) {
                if (facet instanceof KeywordFacet) {
                    vals.set(facet.indexField, facet.selectedValue || '')
                } else if (facet instanceof NumberRangeFacet) {
                    vals.set(facet.indexField, facet.value ? [...facet.value] : null)
                }
            }
            this.localValues = vals
        }
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

    private renderFacetInput(facet: Facet) {
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
                        placeholder="${facet.min ?? ''}"
                        .value="${val?.[0] != null ? String(val[0]) : ''}"
                        @input="${(e: Event) => {
                            const newVals = new Map(this.localValues)
                            const cur = newVals.get(facet.indexField) || [facet.min, facet.max]
                            newVals.set(facet.indexField, [(e.target as HTMLInputElement).valueAsNumber, cur[1]])
                            this.localValues = newVals
                        }}"
                    >
                    <span>to</span>
                    <input
                        type="number"
                        placeholder="${facet.max ?? ''}"
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
        return html`
            <div class="overlay" @click="${this.close}"></div>
            <div class="modal">
                <div class="modal-header">
                    <span class="modal-title">Configure Filters</span>
                    <button class="close-btn" @click="${this.close}">✕</button>
                </div>
                ${this.facets.length === 0 ? html`
                    <div class="no-filters">No filters available. Select a profile from the sidebar first.</div>
                ` : this.facets.map(facet => html`
                    <div class="filter-field">
                        <label class="field-label">${facet.label}</label>
                        ${this.renderFacetInput(facet)}
                    </div>
                `)}
                <div class="modal-footer">
                    <button class="btn-cancel" @click="${this.close}">Cancel</button>
                    <button class="btn-apply" @click="${this.apply}">Apply Filters</button>
                </div>
            </div>
        `
    }
}
