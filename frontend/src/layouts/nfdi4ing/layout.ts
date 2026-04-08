import { css, html, LitElement } from "lit"
import { customElement } from "lit/decorators.js"
import { registerLabel } from "../../i18n"
import { DataFactory } from "n3"

document.title = 'Knowledge Graph Explorer'

registerLabel('sub_heading', [ DataFactory.literal('Your portal to the NFDI4ING Knowledge Graph', 'en'), DataFactory.literal('Ihr Portal zum NFDI4ING Wissensgraph', 'de') ])
registerLabel('service_provided_by', [ DataFactory.literal('This service is provided by University and State Library Darmstadt', 'en'), DataFactory.literal('Dieser Dienst wird von der Universitäts- und Landesbibliothek Darmstadt bereitgestellt', 'de') ])
registerLabel('dfg_hint', [ DataFactory.literal('NFDI4ING is supported by DFG under project number', 'en'), DataFactory.literal('NFDI4ING wird gefördert durch die DFG unter Projektnummer', 'de') ])

@customElement('layout-header')
export class Header extends LitElement {
    static styles = css`
    :host {
        display: flex;
        align-items: center;
        padding: 0 16px;
        min-height: 56px;
        background-color: #fff;
        border-bottom: 1px solid #E5E7EB;
        position: sticky;
        top: 0;
        z-index: 100;
        flex-shrink: 0;
        box-sizing: border-box;
        gap: 8px;
    }
    .logo {
        width: 32px;
        height: 32px;
        background: #2563EB;
        color: #fff;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 16px;
        flex-shrink: 0;
        font-family: "Roboto", sans-serif;
    }
    .title {
        font-size: 15px;
        font-weight: 600;
        color: #111827;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: "Roboto", sans-serif;
    }
    .actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    ::slotted(#header-buttons) { display: flex; gap: 6px; align-items: center; }
    `

    render() {
        return html`
            <div class="logo">N</div>
            <span class="title">NFDI4ING Knowledge Graph Explorer</span>
            <div class="actions">
                <slot></slot>
            </div>
        `
    }
}

@customElement('layout-footer')
export class Footer extends LitElement {
    static styles = css`
    :host { display: none; }
    `
    render() { return html`` }
}
