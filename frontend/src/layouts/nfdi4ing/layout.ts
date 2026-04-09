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
        padding: 0 20px;
        height: 64px;
        background-color: #fff;
        border-bottom: 1px solid #e4e2e5;
        position: sticky;
        top: 0;
        z-index: 100;
        flex-shrink: 0;
        box-sizing: border-box;
        gap: 12px;
    }
    .logo {
        width: 36px;
        height: 36px;
        background: #005db5;
        color: #f6f7ff;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 17px;
        flex-shrink: 0;
        font-family: "Inter", "Roboto", sans-serif;
        letter-spacing: -0.5px;
    }
    .title {
        font-size: 15px;
        font-weight: 600;
        color: #323235;
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-family: "Inter", "Roboto", sans-serif;
        letter-spacing: -0.01em;
    }
    .nav-links {
        display: flex;
        align-items: center;
        gap: 24px;
        font-size: 13px;
    }
    .nav-links a {
        color: #5f5f61;
        text-decoration: none;
        transition: color 0.1s;
        font-family: "Inter", "Roboto", sans-serif;
        font-weight: 500;
    }
    .nav-links a:hover { color: #323235; }
    .actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
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
