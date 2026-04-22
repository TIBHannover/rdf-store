import { css, html, LitElement } from "lit"
import { customElement } from "lit/decorators.js"

const style = document.createElement('style')
style.innerText = `:root { --rokit-primary-color: #005db5; }`
document.head.appendChild(style)

@customElement('layout-header')
export class Header extends LitElement {
    static styles = css`
    :host {
        display: flex;
        align-items: center;
        padding: 0 20px;
        height: 64px;
        background-color: #1a1f36;
        border-bottom: 1px solid #2d3354;
        position: sticky;
        top: 0;
        z-index: 100;
        flex-shrink: 0;
        box-sizing: border-box;
        gap: 12px;
    }
    .logo-wrap {
        flex: 1;
        display: flex;
        align-items: center;
    }
    .logo-img {
        height: 36px;
        width: auto;
        display: block;
        cursor: pointer;
        opacity: 1;
        transition: opacity 0.15s;
    }
    .logo-img:hover { opacity: 0.8; }
    .actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    ::slotted(#header-buttons) { display: flex; gap: 6px; align-items: center; }
    `

    render() {
        return html`
            <div class="logo-wrap">
                <img class="logo-img" src="/NFDI4ING_Wort-Bildmarke_NEG_RGB-DEh5SvlN.png" alt="NFDI4ING"
                    @click="${() => this.dispatchEvent(new CustomEvent('go-home', { bubbles: true, composed: true }))}">
            </div>
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
