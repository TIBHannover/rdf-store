import { css, html, LitElement } from "lit"
import { customElement } from "lit/decorators.js"

const style = document.createElement('style')
style.innerText = `:root { --rokit-primary-color: #2563EB; }`
document.head.appendChild(style)

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
            <div class="logo">R</div>
            <span class="title">RDF Store</span>
            <div class="actions">
                <slot></slot>
            </div>
        `
    }
}

@customElement('layout-footer')
export class Footer extends LitElement {
    static styles = css`:host { display: none; }`
    render() { return html`` }
}
