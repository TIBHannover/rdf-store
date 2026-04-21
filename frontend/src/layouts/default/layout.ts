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
    .actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    ::slotted(#header-buttons) { display: flex; gap: 6px; align-items: center; }
    `

    render() {
        return html`
            <div class="logo">K</div>
            <span class="title">Knowledge Graph Explorer</span>
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
