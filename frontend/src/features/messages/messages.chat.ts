/**
 * Traductions (#122) — écran « Messages équipe » (chat / DM, ADR-035).
 *
 * Module séparé fusionné dans `MESSAGES` (voir lib/i18n/messages.ts). `fr` est la
 * langue de référence : chaque clé `fr` DOIT exister en en/ar/es (test de parité CI).
 * ar (MSA) / es fonctionnels, à faire relire par un locuteur natif avant prod.
 *
 * Réutilise les clés partagées du catalogue de base (`common.*`, `nav.messages`,
 * `nav.close`…) — non redéfinies ici. Les nouvelles clés sont préfixées `chat.`.
 *
 * NB : le contenu des messages, les noms d'utilisateurs/patients et les libellés
 * de canaux/DM viennent du backend (données) — non traduits.
 */
import type { Dict, Lang } from '@/lib/i18n/index';

const fr: Dict = {
  // ── Topbar / en-tête ───────────────────────────────────────────────────────
  'chat.title': 'Messages équipe',
  'chat.titleMobile': 'Messages',
  'chat.sub.members': '{n} membre{s} · {online} en ligne',
  'chat.sub.teamMobile': 'Équipe · {online} en ligne',
  'chat.sub.internal': 'Messagerie interne',
  'chat.filter.all': 'Tous',
  'chat.newMessage': 'Nouveau message',
  'chat.searchAria': 'Rechercher',
  'chat.newMessageAria': 'Nouveau message',

  // ── Rail gauche (sections) ───────────────────────────────────────────────────
  'chat.searchConversation': 'Rechercher une conversation',
  'chat.section.channels': 'Canaux',
  'chat.section.dms': 'Messages directs',
  'chat.section.patientThreads': 'Fils patient',
  'chat.section.addAria': 'Ajouter dans {section}',
  'chat.patientThreadsHint': 'Conversations rattachées à un dossier patient',
  'chat.new': 'NEW',
  'chat.online': 'En ligne',
  'chat.onlineDot': '● En ligne',
  'chat.moreActions': 'Plus d’actions',

  // ── En-tête de conversation ──────────────────────────────────────────────────
  'chat.urgent': 'URGENT',

  // ── Messages / fil ───────────────────────────────────────────────────────────
  'chat.pinned': 'Épinglé :',
  'chat.view': 'Voir',
  'chat.typing': '{who} est en train d’écrire…',
  'chat.typingShort': '{who} écrit…',
  'chat.replies': '{count} réponses',
  'chat.repliesLast': '· dernière {last}',
  'chat.addReaction': 'Ajouter une réaction',
  'chat.patientAge': '{id} · {age} ans',
  'chat.openRecord': 'Ouvrir dossier',
  'chat.members': '{n} membres',

  // ── Composer ─────────────────────────────────────────────────────────────────
  'chat.composer.placeholder':
    'Saisir un message — Entrée pour envoyer, Shift+Entrée pour une nouvelle ligne',
  'chat.composer.placeholderShort': 'Saisir un message',
  'chat.composer.patientAttached': 'Patient joint :',
  'chat.composer.removePatientAria': 'Retirer le patient joint',
  'chat.composer.mentionAria': 'Mentionner un collègue',
  'chat.composer.emojiAria': 'Ajouter une émoticône',
  'chat.composer.attachAria': 'Joindre un document',
  'chat.composer.patient': 'Patient',
  'chat.composer.enterToSend': 'pour envoyer',
  'chat.composer.send': 'Envoyer',
  'chat.composer.sending': 'Envoi…',
  'chat.composer.sendAria': 'Envoyer',

  // ── Popover émoticônes ───────────────────────────────────────────────────────
  'chat.emoji.closeAria': 'Fermer le sélecteur d’émoticônes',
  'chat.emoji.title': 'Émoticônes',
  'chat.emoji.itemAria': 'Émoticône {emoji}',

  // ── Popover mention ──────────────────────────────────────────────────────────
  'chat.mention.closeAria': 'Fermer le sélecteur de mention',
  'chat.mention.title': 'Mentionner un collègue',
  'chat.mention.filterPlaceholder': 'Filtrer…',
  'chat.mention.filterAria': 'Filtrer la liste des collègues à mentionner',
  'chat.mention.noResult': 'Aucun résultat pour « {q} ».',
  'chat.mention.empty': 'Aucun collègue à mentionner.',

  // ── Popover patient ──────────────────────────────────────────────────────────
  'chat.patientPicker.closeAria': 'Fermer le sélecteur de patient',
  'chat.patientPicker.title': 'Joindre un patient',
  'chat.patientPicker.placeholder': 'Rechercher un patient (nom, téléphone)…',
  'chat.patientPicker.aria': 'Rechercher un patient à joindre',
  'chat.patientPicker.minChars': 'Saisissez au moins 2 caractères.',
  'chat.patientPicker.searching': 'Recherche…',
  'chat.patientPicker.noResult': 'Aucun patient pour « {q} ».',

  // ── Rail droit ───────────────────────────────────────────────────────────────
  'chat.right.selectConversation': 'Sélectionnez une conversation.',
  'chat.right.about': 'À propos',
  'chat.right.noDescription': 'Pas de description.',
  'chat.right.members': 'Membres · {n}',
  'chat.right.inviteMember': 'Inviter un membre',
  'chat.right.sharedFiles': 'Fichiers partagés · 0',
  'chat.right.sharedFilesSoon':
    'Le partage de fichiers arrivera dans une prochaine itération (module Documents existant à brancher).',
  'chat.right.linkedPatients': 'Patients liés · {n}',
  'chat.right.patientTag': 'Patient',

  // ── Membres (rail droit) ─────────────────────────────────────────────────────
  'chat.presence.online': 'En ligne',
  'chat.presence.away': 'Absent',
  'chat.presence.offline': 'Hors ligne',
  'chat.presence.you': '(vous)',
  'chat.startDmWithAria': 'Démarrer une discussion avec {name}',

  // ── Picker collègue (desktop + mobile) ───────────────────────────────────────
  'chat.picker.dialogAria': 'Choisir un collègue pour démarrer une discussion',
  'chat.picker.dialogAriaMobile': 'Choisir un collègue',
  'chat.picker.title': 'Nouveau message',
  'chat.picker.subtitle': 'Choisissez un collègue pour ouvrir une discussion privée.',
  'chat.picker.subtitleMobile': 'Choisissez un collègue.',
  'chat.picker.placeholder': 'Rechercher un collègue…',
  'chat.picker.aria': 'Rechercher un collègue par nom ou prénom',
  'chat.picker.loading': 'Chargement…',
  'chat.picker.empty': 'Aucun autre collègue actif.',
  'chat.picker.noResult': 'Aucun collègue ne correspond à « {q} ».',

  // ── Onglets mobile ───────────────────────────────────────────────────────────
  'chat.tab.all': 'Tout',
  'chat.tab.mentions': 'Mentions',
  'chat.tab.unread': 'Non lus',
  'chat.urgentMessage': 'Message urgent · {name}',

  // ── Conversation mobile (topbar) ─────────────────────────────────────────────
  'chat.back': 'Retour',
  'chat.call': 'Appeler',
  'chat.loading': 'Chargement…',

  // ── Pièce jointe ─────────────────────────────────────────────────────────────
  'chat.attach.openFailed': 'Impossible d’ouvrir la pièce jointe.',
  'chat.size.bytes': '{n} o',
  'chat.size.kb': '{n} Ko',
  'chat.size.mb': '{n} Mo',

  // ── Libellés temps (jour / il y a) — useConversation ─────────────────────────
  'chat.day.today': 'aujourd’hui',
  'chat.day.yesterday': 'hier',
  'chat.ago.now': 'à l’instant',
  'chat.ago.minutes': 'il y a {n} min',
  'chat.ago.hours': 'il y a {n} h',
};

const en: Dict = {
  'chat.title': 'Team messages',
  'chat.titleMobile': 'Messages',
  'chat.sub.members': '{n} member{s} · {online} online',
  'chat.sub.teamMobile': 'Team · {online} online',
  'chat.sub.internal': 'Internal messaging',
  'chat.filter.all': 'All',
  'chat.newMessage': 'New message',
  'chat.searchAria': 'Search',
  'chat.newMessageAria': 'New message',

  'chat.searchConversation': 'Search a conversation',
  'chat.section.channels': 'Channels',
  'chat.section.dms': 'Direct messages',
  'chat.section.patientThreads': 'Patient threads',
  'chat.section.addAria': 'Add to {section}',
  'chat.patientThreadsHint': 'Conversations attached to a patient record',
  'chat.new': 'NEW',
  'chat.online': 'Online',
  'chat.onlineDot': '● Online',
  'chat.moreActions': 'More actions',

  'chat.urgent': 'URGENT',

  'chat.pinned': 'Pinned:',
  'chat.view': 'View',
  'chat.typing': '{who} is typing…',
  'chat.typingShort': '{who} typing…',
  'chat.replies': '{count} replies',
  'chat.repliesLast': '· last {last}',
  'chat.addReaction': 'Add a reaction',
  'chat.patientAge': '{id} · {age} yrs',
  'chat.openRecord': 'Open record',
  'chat.members': '{n} members',

  'chat.composer.placeholder':
    'Type a message — Enter to send, Shift+Enter for a new line',
  'chat.composer.placeholderShort': 'Type a message',
  'chat.composer.patientAttached': 'Patient attached:',
  'chat.composer.removePatientAria': 'Remove attached patient',
  'chat.composer.mentionAria': 'Mention a colleague',
  'chat.composer.emojiAria': 'Add an emoji',
  'chat.composer.attachAria': 'Attach a document',
  'chat.composer.patient': 'Patient',
  'chat.composer.enterToSend': 'to send',
  'chat.composer.send': 'Send',
  'chat.composer.sending': 'Sending…',
  'chat.composer.sendAria': 'Send',

  'chat.emoji.closeAria': 'Close the emoji picker',
  'chat.emoji.title': 'Emojis',
  'chat.emoji.itemAria': 'Emoji {emoji}',

  'chat.mention.closeAria': 'Close the mention picker',
  'chat.mention.title': 'Mention a colleague',
  'chat.mention.filterPlaceholder': 'Filter…',
  'chat.mention.filterAria': 'Filter the list of colleagues to mention',
  'chat.mention.noResult': 'No result for “{q}”.',
  'chat.mention.empty': 'No colleague to mention.',

  'chat.patientPicker.closeAria': 'Close the patient picker',
  'chat.patientPicker.title': 'Attach a patient',
  'chat.patientPicker.placeholder': 'Search a patient (name, phone)…',
  'chat.patientPicker.aria': 'Search a patient to attach',
  'chat.patientPicker.minChars': 'Type at least 2 characters.',
  'chat.patientPicker.searching': 'Searching…',
  'chat.patientPicker.noResult': 'No patient for “{q}”.',

  'chat.right.selectConversation': 'Select a conversation.',
  'chat.right.about': 'About',
  'chat.right.noDescription': 'No description.',
  'chat.right.members': 'Members · {n}',
  'chat.right.inviteMember': 'Invite a member',
  'chat.right.sharedFiles': 'Shared files · 0',
  'chat.right.sharedFilesSoon':
    'File sharing will arrive in a future iteration (existing Documents module to wire in).',
  'chat.right.linkedPatients': 'Linked patients · {n}',
  'chat.right.patientTag': 'Patient',

  'chat.presence.online': 'Online',
  'chat.presence.away': 'Away',
  'chat.presence.offline': 'Offline',
  'chat.presence.you': '(you)',
  'chat.startDmWithAria': 'Start a chat with {name}',

  'chat.picker.dialogAria': 'Choose a colleague to start a chat',
  'chat.picker.dialogAriaMobile': 'Choose a colleague',
  'chat.picker.title': 'New message',
  'chat.picker.subtitle': 'Choose a colleague to open a private chat.',
  'chat.picker.subtitleMobile': 'Choose a colleague.',
  'chat.picker.placeholder': 'Search a colleague…',
  'chat.picker.aria': 'Search a colleague by name',
  'chat.picker.loading': 'Loading…',
  'chat.picker.empty': 'No other active colleague.',
  'chat.picker.noResult': 'No colleague matches “{q}”.',

  'chat.tab.all': 'All',
  'chat.tab.mentions': 'Mentions',
  'chat.tab.unread': 'Unread',
  'chat.urgentMessage': 'Urgent message · {name}',

  'chat.back': 'Back',
  'chat.call': 'Call',
  'chat.loading': 'Loading…',

  'chat.attach.openFailed': 'Could not open the attachment.',
  'chat.size.bytes': '{n} B',
  'chat.size.kb': '{n} KB',
  'chat.size.mb': '{n} MB',

  'chat.day.today': 'today',
  'chat.day.yesterday': 'yesterday',
  'chat.ago.now': 'just now',
  'chat.ago.minutes': '{n} min ago',
  'chat.ago.hours': '{n} h ago',
};

const ar: Dict = {
  'chat.title': 'رسائل الفريق',
  'chat.titleMobile': 'الرسائل',
  'chat.sub.members': '{n} عضو · {online} متصل',
  'chat.sub.teamMobile': 'الفريق · {online} متصل',
  'chat.sub.internal': 'المراسلة الداخلية',
  'chat.filter.all': 'الكل',
  'chat.newMessage': 'رسالة جديدة',
  'chat.searchAria': 'بحث',
  'chat.newMessageAria': 'رسالة جديدة',

  'chat.searchConversation': 'ابحث عن محادثة',
  'chat.section.channels': 'القنوات',
  'chat.section.dms': 'الرسائل المباشرة',
  'chat.section.patientThreads': 'مناقشات المرضى',
  'chat.section.addAria': 'إضافة إلى {section}',
  'chat.patientThreadsHint': 'محادثات مرتبطة بملف مريض',
  'chat.new': 'جديد',
  'chat.online': 'متصل',
  'chat.onlineDot': '● متصل',
  'chat.moreActions': 'إجراءات أخرى',

  'chat.urgent': 'عاجل',

  'chat.pinned': 'مثبَّت:',
  'chat.view': 'عرض',
  'chat.typing': '{who} يكتب الآن…',
  'chat.typingShort': '{who} يكتب…',
  'chat.replies': '{count} ردود',
  'chat.repliesLast': '· آخر {last}',
  'chat.addReaction': 'إضافة تفاعل',
  'chat.patientAge': '{id} · {age} سنة',
  'chat.openRecord': 'فتح الملف',
  'chat.members': '{n} أعضاء',

  'chat.composer.placeholder':
    'اكتب رسالة — Enter للإرسال، Shift+Enter لسطر جديد',
  'chat.composer.placeholderShort': 'اكتب رسالة',
  'chat.composer.patientAttached': 'مريض مرفق:',
  'chat.composer.removePatientAria': 'إزالة المريض المرفق',
  'chat.composer.mentionAria': 'الإشارة إلى زميل',
  'chat.composer.emojiAria': 'إضافة رمز تعبيري',
  'chat.composer.attachAria': 'إرفاق مستند',
  'chat.composer.patient': 'مريض',
  'chat.composer.enterToSend': 'للإرسال',
  'chat.composer.send': 'إرسال',
  'chat.composer.sending': 'جارٍ الإرسال…',
  'chat.composer.sendAria': 'إرسال',

  'chat.emoji.closeAria': 'إغلاق منتقي الرموز التعبيرية',
  'chat.emoji.title': 'الرموز التعبيرية',
  'chat.emoji.itemAria': 'رمز تعبيري {emoji}',

  'chat.mention.closeAria': 'إغلاق منتقي الإشارة',
  'chat.mention.title': 'الإشارة إلى زميل',
  'chat.mention.filterPlaceholder': 'تصفية…',
  'chat.mention.filterAria': 'تصفية قائمة الزملاء للإشارة إليهم',
  'chat.mention.noResult': 'لا نتيجة لـ «{q}».',
  'chat.mention.empty': 'لا يوجد زميل للإشارة إليه.',

  'chat.patientPicker.closeAria': 'إغلاق منتقي المريض',
  'chat.patientPicker.title': 'إرفاق مريض',
  'chat.patientPicker.placeholder': 'ابحث عن مريض (الاسم، الهاتف)…',
  'chat.patientPicker.aria': 'ابحث عن مريض لإرفاقه',
  'chat.patientPicker.minChars': 'اكتب حرفين على الأقل.',
  'chat.patientPicker.searching': 'جارٍ البحث…',
  'chat.patientPicker.noResult': 'لا يوجد مريض لـ «{q}».',

  'chat.right.selectConversation': 'اختر محادثة.',
  'chat.right.about': 'حول',
  'chat.right.noDescription': 'لا يوجد وصف.',
  'chat.right.members': 'الأعضاء · {n}',
  'chat.right.inviteMember': 'دعوة عضو',
  'chat.right.sharedFiles': 'الملفات المشتركة · 0',
  'chat.right.sharedFilesSoon':
    'ستتوفر مشاركة الملفات في تحديث لاحق (وحدة المستندات الحالية ستُربط).',
  'chat.right.linkedPatients': 'المرضى المرتبطون · {n}',
  'chat.right.patientTag': 'مريض',

  'chat.presence.online': 'متصل',
  'chat.presence.away': 'غائب',
  'chat.presence.offline': 'غير متصل',
  'chat.presence.you': '(أنت)',
  'chat.startDmWithAria': 'بدء محادثة مع {name}',

  'chat.picker.dialogAria': 'اختر زميلاً لبدء محادثة',
  'chat.picker.dialogAriaMobile': 'اختر زميلاً',
  'chat.picker.title': 'رسالة جديدة',
  'chat.picker.subtitle': 'اختر زميلاً لفتح محادثة خاصة.',
  'chat.picker.subtitleMobile': 'اختر زميلاً.',
  'chat.picker.placeholder': 'ابحث عن زميل…',
  'chat.picker.aria': 'ابحث عن زميل بالاسم',
  'chat.picker.loading': 'جارٍ التحميل…',
  'chat.picker.empty': 'لا يوجد زميل نشط آخر.',
  'chat.picker.noResult': 'لا يوجد زميل يطابق «{q}».',

  'chat.tab.all': 'الكل',
  'chat.tab.mentions': 'الإشارات',
  'chat.tab.unread': 'غير المقروءة',
  'chat.urgentMessage': 'رسالة عاجلة · {name}',

  'chat.back': 'رجوع',
  'chat.call': 'اتصال',
  'chat.loading': 'جارٍ التحميل…',

  'chat.attach.openFailed': 'تعذّر فتح المرفق.',
  'chat.size.bytes': '{n} بايت',
  'chat.size.kb': '{n} ك.ب',
  'chat.size.mb': '{n} م.ب',

  'chat.day.today': 'اليوم',
  'chat.day.yesterday': 'أمس',
  'chat.ago.now': 'الآن',
  'chat.ago.minutes': 'قبل {n} دقيقة',
  'chat.ago.hours': 'قبل {n} ساعة',
};

const es: Dict = {
  'chat.title': 'Mensajes del equipo',
  'chat.titleMobile': 'Mensajes',
  'chat.sub.members': '{n} miembro{s} · {online} en línea',
  'chat.sub.teamMobile': 'Equipo · {online} en línea',
  'chat.sub.internal': 'Mensajería interna',
  'chat.filter.all': 'Todos',
  'chat.newMessage': 'Nuevo mensaje',
  'chat.searchAria': 'Buscar',
  'chat.newMessageAria': 'Nuevo mensaje',

  'chat.searchConversation': 'Buscar una conversación',
  'chat.section.channels': 'Canales',
  'chat.section.dms': 'Mensajes directos',
  'chat.section.patientThreads': 'Hilos de paciente',
  'chat.section.addAria': 'Añadir a {section}',
  'chat.patientThreadsHint': 'Conversaciones vinculadas a un expediente de paciente',
  'chat.new': 'NUEVO',
  'chat.online': 'En línea',
  'chat.onlineDot': '● En línea',
  'chat.moreActions': 'Más acciones',

  'chat.urgent': 'URGENTE',

  'chat.pinned': 'Fijado:',
  'chat.view': 'Ver',
  'chat.typing': '{who} está escribiendo…',
  'chat.typingShort': '{who} escribe…',
  'chat.replies': '{count} respuestas',
  'chat.repliesLast': '· última {last}',
  'chat.addReaction': 'Añadir una reacción',
  'chat.patientAge': '{id} · {age} años',
  'chat.openRecord': 'Abrir expediente',
  'chat.members': '{n} miembros',

  'chat.composer.placeholder':
    'Escribe un mensaje — Intro para enviar, Mayús+Intro para una nueva línea',
  'chat.composer.placeholderShort': 'Escribe un mensaje',
  'chat.composer.patientAttached': 'Paciente adjunto:',
  'chat.composer.removePatientAria': 'Quitar el paciente adjunto',
  'chat.composer.mentionAria': 'Mencionar a un colega',
  'chat.composer.emojiAria': 'Añadir un emoji',
  'chat.composer.attachAria': 'Adjuntar un documento',
  'chat.composer.patient': 'Paciente',
  'chat.composer.enterToSend': 'para enviar',
  'chat.composer.send': 'Enviar',
  'chat.composer.sending': 'Enviando…',
  'chat.composer.sendAria': 'Enviar',

  'chat.emoji.closeAria': 'Cerrar el selector de emojis',
  'chat.emoji.title': 'Emojis',
  'chat.emoji.itemAria': 'Emoji {emoji}',

  'chat.mention.closeAria': 'Cerrar el selector de mención',
  'chat.mention.title': 'Mencionar a un colega',
  'chat.mention.filterPlaceholder': 'Filtrar…',
  'chat.mention.filterAria': 'Filtrar la lista de colegas a mencionar',
  'chat.mention.noResult': 'Ningún resultado para «{q}».',
  'chat.mention.empty': 'Ningún colega para mencionar.',

  'chat.patientPicker.closeAria': 'Cerrar el selector de paciente',
  'chat.patientPicker.title': 'Adjuntar un paciente',
  'chat.patientPicker.placeholder': 'Buscar un paciente (nombre, teléfono)…',
  'chat.patientPicker.aria': 'Buscar un paciente para adjuntar',
  'chat.patientPicker.minChars': 'Escribe al menos 2 caracteres.',
  'chat.patientPicker.searching': 'Buscando…',
  'chat.patientPicker.noResult': 'Ningún paciente para «{q}».',

  'chat.right.selectConversation': 'Selecciona una conversación.',
  'chat.right.about': 'Acerca de',
  'chat.right.noDescription': 'Sin descripción.',
  'chat.right.members': 'Miembros · {n}',
  'chat.right.inviteMember': 'Invitar a un miembro',
  'chat.right.sharedFiles': 'Archivos compartidos · 0',
  'chat.right.sharedFilesSoon':
    'El uso compartido de archivos llegará en una próxima iteración (módulo Documentos existente por conectar).',
  'chat.right.linkedPatients': 'Pacientes vinculados · {n}',
  'chat.right.patientTag': 'Paciente',

  'chat.presence.online': 'En línea',
  'chat.presence.away': 'Ausente',
  'chat.presence.offline': 'Desconectado',
  'chat.presence.you': '(tú)',
  'chat.startDmWithAria': 'Iniciar una conversación con {name}',

  'chat.picker.dialogAria': 'Elige un colega para iniciar una conversación',
  'chat.picker.dialogAriaMobile': 'Elige un colega',
  'chat.picker.title': 'Nuevo mensaje',
  'chat.picker.subtitle': 'Elige un colega para abrir una conversación privada.',
  'chat.picker.subtitleMobile': 'Elige un colega.',
  'chat.picker.placeholder': 'Buscar un colega…',
  'chat.picker.aria': 'Buscar un colega por nombre',
  'chat.picker.loading': 'Cargando…',
  'chat.picker.empty': 'Ningún otro colega activo.',
  'chat.picker.noResult': 'Ningún colega coincide con «{q}».',

  'chat.tab.all': 'Todo',
  'chat.tab.mentions': 'Menciones',
  'chat.tab.unread': 'No leídos',
  'chat.urgentMessage': 'Mensaje urgente · {name}',

  'chat.back': 'Volver',
  'chat.call': 'Llamar',
  'chat.loading': 'Cargando…',

  'chat.attach.openFailed': 'No se pudo abrir el adjunto.',
  'chat.size.bytes': '{n} B',
  'chat.size.kb': '{n} KB',
  'chat.size.mb': '{n} MB',

  'chat.day.today': 'hoy',
  'chat.day.yesterday': 'ayer',
  'chat.ago.now': 'ahora mismo',
  'chat.ago.minutes': 'hace {n} min',
  'chat.ago.hours': 'hace {n} h',
};

export const chatMessages: Record<Lang, Dict> = { fr, en, ar, es };
