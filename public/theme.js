// Anti-flash thème : pose data-theme sur <html> avant le premier paint,
// pour éviter un clignotement clair→sombre au chargement.
;(function () {
  var t =
    localStorage.getItem('woui-theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  document.documentElement.dataset.theme = t
})()
