/**
 * Traductions (#122) — composants partagés du shell + UI (`src/components/shell`
 * et `src/components/ui`).
 *
 * Module séparé fusionné dans `MESSAGES` (voir lib/i18n/messages.ts). `fr` est la
 * langue de référence : chaque clé `fr` DOIT exister en en/ar/es (test de parité CI).
 * ar/es fonctionnels, à faire relire par un locuteur natif avant prod.
 *
 * Réutilise les clés du catalogue de base partout où elles collent
 * (`common.close`, `common.cancel`, `nav.*`, `role.*`, `mnav.profile`,
 * `mnav.logout`) — non redéfinies ici. Les nouvelles chaînes sont préfixées
 * `ui.*` (namespace exclusif à ce module — vérifié sans collision).
 *
 * NB : `ErrorBoundary` reste volontairement en français en dur — c'est le filet
 * de sécurité monté AU-DESSUS de `I18nProvider` (cf. App.tsx) ; il doit rester
 * fonctionnel même si le runtime i18n est ce qui a planté.
 */
import type { Dict, Lang } from '@/lib/i18n/index';

const fr: Dict = {
  // ── Navigation desktop (Sidebar) ──────────────────────────────────────────
  'ui.nav.main': 'Navigation principale',
  'ui.nav.searchMenu': 'Rechercher un menu ou une fonctionnalité',
  'ui.nav.badge': '{n} en attente',

  // ── Navigation mobile (MTabs / MTechTabs) ─────────────────────────────────
  'ui.mnav.mobile': 'Navigation mobile',
  'ui.mtab.salle': 'Salle',
  'ui.mtab.factures': 'Factures',
  'ui.mtab.more': 'Plus',
  'ui.mtab.queue': 'File',
  'ui.mtab.profil': 'Profil',
  'ui.mtab.badge': '{n} notification{s}',

  // ── Topbar ────────────────────────────────────────────────────────────────
  'ui.topbar.searchPatient': 'Rechercher un patient',

  // ── Spotlight recherche patient (PatientSearchSpotlight) ──────────────────
  'ui.spotlight.title': 'Rechercher un patient',
  'ui.spotlight.placeholder': 'Nom, téléphone, CIN…',
  'ui.spotlight.escToClose': 'Esc pour fermer',
  'ui.spotlight.minChars': 'Tapez au moins 2 caractères pour lancer la recherche.',
  'ui.spotlight.searching': 'Recherche en cours…',
  'ui.spotlight.noResult': 'Aucun patient trouvé pour « {q} ».',
  'ui.spotlight.years': '{n} ans',

  // ── Boutons d'upload de document (DocumentUploadButton) ───────────────────
  'ui.upload.upload': 'Téléverser',
  'ui.upload.camera': 'Photographier',

  // ── Capture caméra (WebcamCaptureModal) ───────────────────────────────────
  'ui.webcam.title': 'Capture caméra',
  'ui.webcam.capture': 'Capturer',
  'ui.webcam.capturing': 'Capture…',
  'ui.webcam.err.insecure.title': 'Contexte non sécurisé',
  'ui.webcam.err.insecure.detail': "L'accès caméra n'est autorisé que sur HTTPS ou localhost.",
  'ui.webcam.err.insecure.hint': "Ouvrez l'application en HTTPS, ou testez en local sur http://localhost.",
  'ui.webcam.err.unsupported.title': 'Capture non supportée',
  'ui.webcam.err.unsupported.detail': 'Ce navigateur ne supporte pas la capture caméra.',
  'ui.webcam.err.unsupported.hint': 'Mettez à jour Chrome / Edge / Firefox vers la dernière version.',
  'ui.webcam.err.denied.title': 'Permission caméra refusée',
  'ui.webcam.err.denied.detail': "Le navigateur a bloqué l'accès à la caméra.",
  'ui.webcam.err.denied.hint1': "Cliquez sur l'icône caméra dans la barre d'adresse et choisissez « Toujours autoriser ».",
  'ui.webcam.err.denied.hint2': 'Puis cliquez sur « Réessayer ».',
  'ui.webcam.err.busy.title': 'Caméra occupée',
  'ui.webcam.err.busy.detail': 'Une autre application utilise déjà la caméra.',
  'ui.webcam.err.busy.hint1': "Fermez Zoom / Teams / Meet / OBS / Skype / l'app Caméra Windows.",
  'ui.webcam.err.busy.hint2': 'Puis cliquez sur « Réessayer ».',
  'ui.webcam.err.noCam.title': 'Aucune caméra accessible',
  'ui.webcam.err.noCam.detail': "Le système n'expose aucun périphérique caméra à ce navigateur.",
  'ui.webcam.err.noCam.hint1': 'Windows : Paramètres → Confidentialité et sécurité → Caméra → activez « Autoriser les applications à accéder à votre caméra » ET « Autoriser les applications de bureau à accéder à votre caméra ».',
  'ui.webcam.err.noCam.hint2': "Vérifiez le commutateur physique de la webcam (touche F-x ou interrupteur sur l'écran).",
  'ui.webcam.err.noCam.hint3': 'Branchez/débranchez la webcam externe et rechargez la page.',
  'ui.webcam.err.generic.title': 'Caméra inaccessible',
  'ui.webcam.err.generic.detail': 'Erreur inconnue.',
  'ui.webcam.err.generic.hint': 'Rechargez la page et réessayez.',
  'ui.webcam.err.capture.title': 'Capture impossible',
  'ui.webcam.err.capture.hint': 'Réessayez. Si le problème persiste, rechargez la page.',
  'ui.webcam.retry': 'Réessayer',
  'ui.webcam.codeLabel': 'code : {code}',
};

const en: Dict = {
  'ui.nav.main': 'Main navigation',
  'ui.nav.searchMenu': 'Search a menu or feature',
  'ui.nav.badge': '{n} waiting',

  'ui.mnav.mobile': 'Mobile navigation',
  'ui.mtab.salle': 'Waiting',
  'ui.mtab.factures': 'Invoices',
  'ui.mtab.more': 'More',
  'ui.mtab.queue': 'Queue',
  'ui.mtab.profil': 'Profile',
  'ui.mtab.badge': '{n} notification{s}',

  'ui.topbar.searchPatient': 'Search a patient',

  'ui.spotlight.title': 'Search a patient',
  'ui.spotlight.placeholder': 'Name, phone, ID…',
  'ui.spotlight.escToClose': 'Esc to close',
  'ui.spotlight.minChars': 'Type at least 2 characters to start searching.',
  'ui.spotlight.searching': 'Searching…',
  'ui.spotlight.noResult': 'No patient found for “{q}”.',
  'ui.spotlight.years': '{n} yrs',

  'ui.upload.upload': 'Upload',
  'ui.upload.camera': 'Take a photo',

  'ui.webcam.title': 'Camera capture',
  'ui.webcam.capture': 'Capture',
  'ui.webcam.capturing': 'Capturing…',
  'ui.webcam.err.insecure.title': 'Insecure context',
  'ui.webcam.err.insecure.detail': 'Camera access is only allowed over HTTPS or localhost.',
  'ui.webcam.err.insecure.hint': 'Open the application over HTTPS, or test locally on http://localhost.',
  'ui.webcam.err.unsupported.title': 'Capture not supported',
  'ui.webcam.err.unsupported.detail': 'This browser does not support camera capture.',
  'ui.webcam.err.unsupported.hint': 'Update Chrome / Edge / Firefox to the latest version.',
  'ui.webcam.err.denied.title': 'Camera permission denied',
  'ui.webcam.err.denied.detail': 'The browser blocked access to the camera.',
  'ui.webcam.err.denied.hint1': 'Click the camera icon in the address bar and choose “Always allow”.',
  'ui.webcam.err.denied.hint2': 'Then click “Retry”.',
  'ui.webcam.err.busy.title': 'Camera busy',
  'ui.webcam.err.busy.detail': 'Another application is already using the camera.',
  'ui.webcam.err.busy.hint1': 'Close Zoom / Teams / Meet / OBS / Skype / the Windows Camera app.',
  'ui.webcam.err.busy.hint2': 'Then click “Retry”.',
  'ui.webcam.err.noCam.title': 'No camera available',
  'ui.webcam.err.noCam.detail': 'The system exposes no camera device to this browser.',
  'ui.webcam.err.noCam.hint1': 'Windows: Settings → Privacy & security → Camera → enable “Let apps access your camera” AND “Let desktop apps access your camera”.',
  'ui.webcam.err.noCam.hint2': 'Check the physical webcam switch (F-x key or a switch on the screen).',
  'ui.webcam.err.noCam.hint3': 'Plug/unplug the external webcam and reload the page.',
  'ui.webcam.err.generic.title': 'Camera unavailable',
  'ui.webcam.err.generic.detail': 'Unknown error.',
  'ui.webcam.err.generic.hint': 'Reload the page and try again.',
  'ui.webcam.err.capture.title': 'Capture failed',
  'ui.webcam.err.capture.hint': 'Try again. If the problem persists, reload the page.',
  'ui.webcam.retry': 'Retry',
  'ui.webcam.codeLabel': 'code: {code}',
};

const ar: Dict = {
  'ui.nav.main': 'التنقل الرئيسي',
  'ui.nav.searchMenu': 'ابحث عن قائمة أو وظيفة',
  'ui.nav.badge': '{n} في الانتظار',

  'ui.mnav.mobile': 'التنقل على الهاتف',
  'ui.mtab.salle': 'الانتظار',
  'ui.mtab.factures': 'الفواتير',
  'ui.mtab.more': 'المزيد',
  'ui.mtab.queue': 'القائمة',
  'ui.mtab.profil': 'الملف',
  'ui.mtab.badge': '{n} إشعار{s}',

  'ui.topbar.searchPatient': 'ابحث عن مريض',

  'ui.spotlight.title': 'ابحث عن مريض',
  'ui.spotlight.placeholder': 'الاسم، الهاتف، رقم التعريف…',
  'ui.spotlight.escToClose': 'Esc للإغلاق',
  'ui.spotlight.minChars': 'اكتب حرفين على الأقل لبدء البحث.',
  'ui.spotlight.searching': 'جارٍ البحث…',
  'ui.spotlight.noResult': 'لم يُعثر على مريض لـ «{q}».',
  'ui.spotlight.years': '{n} سنة',

  'ui.upload.upload': 'رفع',
  'ui.upload.camera': 'التقاط صورة',

  'ui.webcam.title': 'التقاط بالكاميرا',
  'ui.webcam.capture': 'التقاط',
  'ui.webcam.capturing': 'جارٍ الالتقاط…',
  'ui.webcam.err.insecure.title': 'سياق غير آمن',
  'ui.webcam.err.insecure.detail': 'لا يُسمح بالوصول إلى الكاميرا إلا عبر HTTPS أو localhost.',
  'ui.webcam.err.insecure.hint': 'افتح التطبيق عبر HTTPS، أو اختبره محليًا على http://localhost.',
  'ui.webcam.err.unsupported.title': 'الالتقاط غير مدعوم',
  'ui.webcam.err.unsupported.detail': 'هذا المتصفح لا يدعم الالتقاط بالكاميرا.',
  'ui.webcam.err.unsupported.hint': 'حدّث Chrome / Edge / Firefox إلى آخر إصدار.',
  'ui.webcam.err.denied.title': 'رُفض إذن الكاميرا',
  'ui.webcam.err.denied.detail': 'حظر المتصفح الوصول إلى الكاميرا.',
  'ui.webcam.err.denied.hint1': 'انقر على أيقونة الكاميرا في شريط العنوان واختر «السماح دائمًا».',
  'ui.webcam.err.denied.hint2': 'ثم انقر على «إعادة المحاولة».',
  'ui.webcam.err.busy.title': 'الكاميرا مشغولة',
  'ui.webcam.err.busy.detail': 'يستخدم تطبيق آخر الكاميرا بالفعل.',
  'ui.webcam.err.busy.hint1': 'أغلق Zoom / Teams / Meet / OBS / Skype / تطبيق كاميرا Windows.',
  'ui.webcam.err.busy.hint2': 'ثم انقر على «إعادة المحاولة».',
  'ui.webcam.err.noCam.title': 'لا توجد كاميرا متاحة',
  'ui.webcam.err.noCam.detail': 'لا يُظهر النظام أي جهاز كاميرا لهذا المتصفح.',
  'ui.webcam.err.noCam.hint1': 'Windows: الإعدادات → الخصوصية والأمان → الكاميرا → فعّل «السماح للتطبيقات بالوصول إلى الكاميرا» و«السماح لتطبيقات سطح المكتب بالوصول إلى الكاميرا».',
  'ui.webcam.err.noCam.hint2': 'تحقق من المفتاح الفعلي للكاميرا (مفتاح F-x أو مفتاح على الشاشة).',
  'ui.webcam.err.noCam.hint3': 'افصل/أعد توصيل الكاميرا الخارجية وأعد تحميل الصفحة.',
  'ui.webcam.err.generic.title': 'الكاميرا غير متاحة',
  'ui.webcam.err.generic.detail': 'خطأ غير معروف.',
  'ui.webcam.err.generic.hint': 'أعد تحميل الصفحة وحاول مجددًا.',
  'ui.webcam.err.capture.title': 'تعذّر الالتقاط',
  'ui.webcam.err.capture.hint': 'حاول مجددًا. إذا استمرت المشكلة، أعد تحميل الصفحة.',
  'ui.webcam.retry': 'إعادة المحاولة',
  'ui.webcam.codeLabel': 'الرمز: {code}',
};

const es: Dict = {
  'ui.nav.main': 'Navegación principal',
  'ui.nav.searchMenu': 'Buscar un menú o una función',
  'ui.nav.badge': '{n} en espera',

  'ui.mnav.mobile': 'Navegación móvil',
  'ui.mtab.salle': 'Espera',
  'ui.mtab.factures': 'Facturas',
  'ui.mtab.more': 'Más',
  'ui.mtab.queue': 'Cola',
  'ui.mtab.profil': 'Perfil',
  'ui.mtab.badge': '{n} notificación{s}',

  'ui.topbar.searchPatient': 'Buscar un paciente',

  'ui.spotlight.title': 'Buscar un paciente',
  'ui.spotlight.placeholder': 'Nombre, teléfono, DNI…',
  'ui.spotlight.escToClose': 'Esc para cerrar',
  'ui.spotlight.minChars': 'Escribe al menos 2 caracteres para iniciar la búsqueda.',
  'ui.spotlight.searching': 'Buscando…',
  'ui.spotlight.noResult': 'Ningún paciente encontrado para «{q}».',
  'ui.spotlight.years': '{n} años',

  'ui.upload.upload': 'Subir',
  'ui.upload.camera': 'Hacer una foto',

  'ui.webcam.title': 'Captura con cámara',
  'ui.webcam.capture': 'Capturar',
  'ui.webcam.capturing': 'Capturando…',
  'ui.webcam.err.insecure.title': 'Contexto no seguro',
  'ui.webcam.err.insecure.detail': 'El acceso a la cámara solo se permite por HTTPS o localhost.',
  'ui.webcam.err.insecure.hint': 'Abre la aplicación por HTTPS, o pruébala localmente en http://localhost.',
  'ui.webcam.err.unsupported.title': 'Captura no compatible',
  'ui.webcam.err.unsupported.detail': 'Este navegador no admite la captura con cámara.',
  'ui.webcam.err.unsupported.hint': 'Actualiza Chrome / Edge / Firefox a la última versión.',
  'ui.webcam.err.denied.title': 'Permiso de cámara denegado',
  'ui.webcam.err.denied.detail': 'El navegador bloqueó el acceso a la cámara.',
  'ui.webcam.err.denied.hint1': 'Haz clic en el icono de la cámara en la barra de direcciones y elige «Permitir siempre».',
  'ui.webcam.err.denied.hint2': 'Luego haz clic en «Reintentar».',
  'ui.webcam.err.busy.title': 'Cámara ocupada',
  'ui.webcam.err.busy.detail': 'Otra aplicación ya está usando la cámara.',
  'ui.webcam.err.busy.hint1': 'Cierra Zoom / Teams / Meet / OBS / Skype / la app Cámara de Windows.',
  'ui.webcam.err.busy.hint2': 'Luego haz clic en «Reintentar».',
  'ui.webcam.err.noCam.title': 'Ninguna cámara accesible',
  'ui.webcam.err.noCam.detail': 'El sistema no expone ningún dispositivo de cámara a este navegador.',
  'ui.webcam.err.noCam.hint1': 'Windows: Configuración → Privacidad y seguridad → Cámara → activa «Permitir que las aplicaciones accedan a la cámara» Y «Permitir que las aplicaciones de escritorio accedan a la cámara».',
  'ui.webcam.err.noCam.hint2': 'Comprueba el interruptor físico de la webcam (tecla F-x o interruptor en la pantalla).',
  'ui.webcam.err.noCam.hint3': 'Conecta/desconecta la webcam externa y recarga la página.',
  'ui.webcam.err.generic.title': 'Cámara inaccesible',
  'ui.webcam.err.generic.detail': 'Error desconocido.',
  'ui.webcam.err.generic.hint': 'Recarga la página e inténtalo de nuevo.',
  'ui.webcam.err.capture.title': 'Captura imposible',
  'ui.webcam.err.capture.hint': 'Inténtalo de nuevo. Si el problema persiste, recarga la página.',
  'ui.webcam.retry': 'Reintentar',
  'ui.webcam.codeLabel': 'código: {code}',
};

export const shellMessages: Record<Lang, Dict> = { fr, en, ar, es };
