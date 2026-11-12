const paths = {
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13"/>',
  play: '<path d="m9 5 11 7-11 7V5Z" fill="currentColor" stroke="none"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6M8 13h8m-8 4h5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 5v2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  chart: '<path d="M3 3v18h18M7 15l4-4 4 2 5-6"/>',
  pen: '<path d="m13 6 5 5M5 19l4-1 11-11a2.8 2.8 0 0 0-4-4L5 14l-1 5 1 0Zm-2 3h18"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-13.8-5.5L3 9m0 0V4m0 5h5m-4 4a8 8 0 0 0 13.8 5.5L21 15m0 0v5m0-5h-5"/>',
  tooth: '<path d="M12 5c-3.5-3.3-8-2.2-8 2.5 0 3.2 1.6 4.1 2.4 7.1.5 2.1.7 5.4 2.2 5.4 1.8 0 .8-5.3 3.4-5.3s1.6 5.3 3.4 5.3c1.5 0 1.7-3.3 2.2-5.4.8-3 2.4-3.9 2.4-7.1C20 2.8 15.5 1.7 12 5Z"/>',
  external: '<path d="M13 5h6v6m0-6-9 9m6-1v5H6V8h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
};
export const icon = (name, className = '') => `<svg class="icon ${className}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
export const pill = (label, color = 'purple') => `<span class="status ${color}"><i></i>${label}</span>`;
export const mark = (name, color = 'purple') => `<span class="icon-tile ${color}">${icon(name)}</span>`;
const signature = '<svg class="signature-line" viewBox="0 0 230 55" fill="none" aria-hidden="true"><path d="M4 45c20-9 37-40 29-40-7 0-14 23-6 31 7 8 15-5 18-11-7 11-4 16 2 13 5-3 11-13 13-13 3 0-5 14 0 13 6-1 9-8 15-12 4-3 1 11 10 9 13-3 31-31 22-33-9-1-17 23-13 31 4 9 13-7 20-10 5-2 0 12 6 10 8-2 13-10 17-9 4 1-2 8 4 8 10 0 13-9 19-8 4 1-2 7 5 7 10 0 25-5 45-5M31 49c44-5 94-12 155-10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const chart = `<div class="chart-bars">${[36, 58, 44, 86, 63, 75, 54].map((h,i) => `<div><i style="--bar:${h}%;--delay:${i * 65}ms"></i><span>${['L','M','M','J','V','S','D'][i]}</span></div>`).join('')}</div>`;
export const bars = `<div class="mini-card bars-card"><div class="mini-top"><strong>Suivi des consentements</strong><small>Cette semaine</small></div>${chart}<div class="mini-bottom"><span><b>12</b> Envoyés</span><span><b>8</b> Signés</span></div></div>`;
const timelineRows = [
  ['send','Lien envoyé','09:41','purple'],
  ['eye','Lien ouvert','10:06','blue'],
  ['play','Vidéo visionnée','10:09','purple'],
  ['check','Consentement signé','10:12','green'],
];
export const timeline = `<div class="mini-card timeline-card"><div class="mini-top"><strong>Activité du consentement</strong><small class="live"><i></i> En direct</small></div><div class="timeline">${timelineRows.map(([symbol,label,time,color]) => `<div class="event">${mark(symbol,color)}<b>${label}</b><small>${time}</small></div>`).join('')}</div></div>`;
export const signed = `<div class="mini-card signed-card"><div class="mini-top"><strong>Document de consentement</strong>${pill('Signé','green')}</div><div class="signature-paper"><div class="paper-lines"><i></i><i></i><i></i></div>${signature}</div><div class="mini-bottom">${icon('lock')} <span>PDF signé et horodaté</span></div></div>`;
export const email = `<div class="mini-card mail-card"><div class="mini-top">${mark('mail')}<div><strong>Votre lien de consentement</strong><small>Envoyé par votre cabinet dentaire</small></div></div><div class="paper-lines"><i></i><i></i></div><span class="ui-button">Consulter mon consentement ${icon('arrow')}</span></div>`;
export const patient = `<div class="patient-ui"><div class="mini-top"><img src="/assets/woui.png" alt="" width="56" height="14">${pill('Aperçu','purple')}</div><h4>Votre consentement</h4><small>Votre praticien vous invite à consulter les informations liées à votre soin.</small><div class="player"><span>${icon('play')}</span><div class="player-progress"></div></div><div class="patient-sign">${mark('pen')} <span><b>Signature électronique</b><small>Après le visionnage</small></span>${icon('lock')}</div></div>`;
const demoPeople = [
  ['CM','Camille M.','Implant dentaire','Signé','green','12 nov.'],
  ['LR','Louise R.','Couronne céramique','Visionné','purple','12 nov.'],
  ['AN','Alex N.','Extraction dentaire','Lien ouvert','blue','11 nov.'],
  ['SB','Sacha B.','Traitement de canal','Envoyé','gray','11 nov.'],
];
export const dashboard = `<div class="dashboard"><div class="dashboard-top"><img src="/assets/woui.png" alt="" width="70" height="17"><div class="dashboard-tabs"><span>Tableau de bord</span><span>Paramètres</span></div><i class="avatar">W</i></div><div class="dashboard-body"><div class="dashboard-title"><div><small>ESPACE PRATICIEN</small><h3>Consentements</h3></div><span class="ui-button">${icon('plus')} Nouveau consentement</span></div><div class="dashboard-kpis">${[['send','Envoyés',12],['eye','Visionnés',9],['check','Signés',8]].map(([symbol,label,n],i) => `<div>${mark(symbol,i === 2 ? 'green' : 'purple')}<span><small>${label}</small><b>${n}</b></span></div>`).join('')}</div><table aria-label="Exemple de suivi des consentements"><thead><tr><th>Patient</th><th>Acte dentaire</th><th>Statut</th><th>Date d’envoi</th></tr></thead><tbody>${demoPeople.map(([initials,name,act,status,color,date]) => `<tr><td><span class="avatar">${initials}</span><b>${name}</b></td><td>${act}</td><td>${pill(status,color)}</td><td>${date}</td></tr>`).join('')}</tbody></table></div></div>`;
