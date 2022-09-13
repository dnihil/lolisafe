/* global SwaggerUIBundle, SwaggerUIStandalonePreset */

window.addEventListener('DOMContentLoaded', () => {
  const mainScript = document.querySelector('#mainScript')
  const name = mainScript && mainScript.dataset.name
    ? mainScript.dataset.name
    : 'lolisafe'

  window.ui = SwaggerUIBundle({
    urls: [
      // Expects openapi.json to be publicly accessible via GET /openapi.json route
      { url: 'openapi.json', name }
    ],
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: 'StandaloneLayout'
  })
})
