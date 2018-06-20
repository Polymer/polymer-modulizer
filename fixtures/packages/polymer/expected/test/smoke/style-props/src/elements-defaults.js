import { html } from '../../../../lib/utils/html-tag.js';

const $_documentContainer = html`<style is="custom-style">
  html {
    --x-s: {
      display: inline-block;
      margin: 16px;
      border-radius: 4px;
      padding: 2px;
    };
  }
</style>`;

document.head.appendChild($_documentContainer.content);
