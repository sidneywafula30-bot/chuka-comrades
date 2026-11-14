OFFICIAL PROVIDER LOGOS
Download each provider's logo from its own brand / press page and save it here as <id>.svg (or <id>.png):

  mit-ocw  yale  harvard  stanford  khan  saylor  freecodecamp  openlearn  microsoft
  google  ibm  aws  coursera  edx  futurelearn  udacity  alison

Then open src/components/ProviderLogo.tsx and list each file you added in LOCAL_LOGOS, e.g.
  const LOCAL_LOGOS = { 'mit-ocw': 'svg', coursera: 'png' }

Until a file is listed, the app uses the brand glyph (8 providers), then the site's own icon, then initials.
Follow each brand's usage rules. Logos belong to their owners and are shown only to identify the provider.
