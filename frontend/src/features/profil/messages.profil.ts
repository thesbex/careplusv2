/**
 * Traductions (#122) — écran « Mon profil » (réglages personnels du user connecté).
 *
 * Module séparé fusionné dans `MESSAGES` (voir lib/i18n/messages.ts). `fr` est la
 * langue de référence : chaque clé `fr` DOIT exister en en/ar/es (test de parité CI).
 * ar/es fonctionnels, à faire relire par un locuteur natif avant prod.
 *
 * Réutilise les clés partagées du catalogue de base : `common.cancel`, `common.save`,
 * `common.create`, `role.*` — non redéfinies ici. Les nouvelles clés sont préfixées
 * `profil.`. Les données (nom, email du user) ne sont pas traduites.
 */
import type { Dict, Lang } from '@/lib/i18n/index';

const fr: Dict = {
  // ── En-tête / page ───────────────────────────────────────────────────────
  'profil.title': 'Mon profil',
  'profil.back': 'Retour',

  // ── Identité ─────────────────────────────────────────────────────────────
  'profil.identity.title': 'Identité',
  'profil.identity.name': 'Nom :',
  'profil.identity.email': 'Email :',
  'profil.identity.roles': 'Rôles :',

  // ── Signature (note non-médecin) ───────────────────────────────────────────
  'profil.signatureNote':
    "La signature scannée n'est utilisée que par les médecins (sur les ordonnances, certificats et carnets de vaccination qu'ils génèrent).",

  // ── Modèles d'ordonnance ────────────────────────────────────────────────────
  'profil.templates.rx.title': "Mes modèles d'ordonnance",
  'profil.templates.rx.hint':
    'Modèles personnels réutilisables en consultation (médicaments, analyses, imagerie).',
  'profil.templates.soap.title': 'Mes modèles de consultation (SOAP)',
  'profil.templates.soap.hint':
    "Pré-remplissent les sections Subjectif / Objectif / Analyse / Plan depuis l'écran de consultation.",
  'profil.templates.letter.title': 'Mes modèles de courrier au confrère',
  'profil.templates.letter.hint':
    'Modèles personnels (titre + contenu) pour pré-remplir une lettre adressée à un confrère.',

  // ── Photo de profil ──────────────────────────────────────────────────────────
  'profil.photo.title': 'Photo de profil',
  'profil.photo.hint':
    'Visible dans la messagerie interne à la place de vos initiales. JPEG, PNG, WebP ou HEIC — 2 Mo max.',
  'profil.photo.alt': 'Votre photo de profil',
  'profil.photo.replace': 'Remplacer la photo',
  'profil.photo.upload': 'Téléverser une photo',
  'profil.photo.remove': 'Retirer',
  'profil.photo.tooLarge': 'Photo trop volumineuse (max 2 Mo).',
  'profil.photo.updated': 'Photo mise à jour.',
  'profil.photo.unsupported': 'Format non supporté',
  'profil.photo.unsupportedDesc': 'Acceptés : JPEG, PNG, WebP, HEIC.',
  'profil.photo.uploadFailed': 'Échec du téléversement.',
  'profil.photo.removed': 'Photo retirée.',
  'profil.photo.removeFailed': 'Échec de la suppression.',

  // ── Mot de passe ──────────────────────────────────────────────────────────────
  'profil.password.title': 'Mot de passe',
  'profil.password.hint':
    'Modifiez votre mot de passe à tout moment. Vous resterez connecté à cette session.',
  'profil.password.current': 'Mot de passe actuel',
  'profil.password.new': 'Nouveau mot de passe',
  'profil.password.minHint': '12 caractères minimum.',
  'profil.password.confirm': 'Confirmer',
  'profil.password.submit': 'Mettre à jour',
  'profil.password.saving': 'Enregistrement…',
  'profil.password.errCurrentRequired': 'Le mot de passe actuel est requis.',
  'profil.password.errTooShort': 'Le nouveau mot de passe doit faire au moins 12 caractères.',
  'profil.password.errMismatch': 'Les deux mots de passe ne correspondent pas.',
  'profil.password.errSameAsCurrent': "Le nouveau mot de passe doit être différent de l'actuel.",
  'profil.password.errInvalidCurrent': 'Le mot de passe actuel est incorrect.',
  'profil.password.updated': 'Mot de passe mis à jour.',

  // ── Pause déjeuner ──────────────────────────────────────────────────────────────
  'profil.lunch.title': 'Ma pause déjeuner',
  'profil.lunch.hint':
    'Pendant cette plage, aucun rendez-vous ne peut être pris sur votre agenda (tous les jours travaillés).',
  'profil.lunch.loading': 'Chargement…',
  'profil.lunch.start': 'Début',
  'profil.lunch.end': 'Fin',
  'profil.lunch.save': 'Enregistrer',
  'profil.lunch.saving': 'Enregistrement…',
  'profil.lunch.remove': 'Retirer',
  'profil.lunch.errEndAfterStart': "L'heure de fin doit être après l'heure de début.",
  'profil.lunch.saved': 'Pause déjeuner enregistrée.',
  'profil.lunch.saveFailed': "Échec de l'enregistrement.",
  'profil.lunch.removed': 'Pause déjeuner retirée.',
  'profil.lunch.removeFailed': 'Suppression impossible.',
  'profil.lunch.active': 'Pause active : {start} – {end}.',
  'profil.lunch.none': 'Aucune pause configurée — les rendez-vous sont autorisés toute la journée.',

  // ── Carnet de confrères ──────────────────────────────────────────────────────────
  'profil.referrals.title': 'Mes confrères',
  'profil.referrals.hint':
    "Carnet personnel pour orienter vos patients vers d'autres spécialistes.",
  'profil.referrals.close': 'Fermer',
  'profil.referrals.new': 'Nouveau confrère',
  'profil.referrals.fullName': 'Nom complet *',
  'profil.referrals.fullNamePlaceholder': 'Dr Hassan Cherkaoui',
  'profil.referrals.phone': 'Téléphone',
  'profil.referrals.phonePlaceholder': '+212 5 22 ...',
  'profil.referrals.city': 'Ville',
  'profil.referrals.cityPlaceholder': 'Casablanca',
  'profil.referrals.notes': 'Notes',
  'profil.referrals.notesPlaceholder':
    'Pratique privée, accepte CNOPS, joignable matin uniquement…',
  'profil.referrals.cancel': 'Annuler',
  'profil.referrals.save': 'Enregistrer',
  'profil.referrals.saving': 'Enregistrement…',
  'profil.referrals.create': 'Créer',
  'profil.referrals.creating': 'Création…',
  'profil.referrals.specialtyLabel': 'Spécialité :',
  'profil.referrals.filterBySpecialty': 'Filtrer par spécialité',
  'profil.referrals.allSpecialties': 'Toutes ({n})',
  'profil.referrals.loading': 'Chargement…',
  'profil.referrals.emptyAll': 'Aucun confrère encore enregistré. Commencez par « Nouveau confrère ».',
  'profil.referrals.emptySpecialty': 'Aucun confrère pour cette spécialité.',
  'profil.referrals.editAria': 'Modifier {name}',
  'profil.referrals.edit': 'Modifier',
  'profil.referrals.deleteAria': 'Supprimer {name}',
  'profil.referrals.specialty': 'Spécialité *',
  'profil.referrals.specialtySelect': '— Sélectionner —',
  'profil.referrals.specialtyOther': 'Autre… (saisir)',
  'profil.referrals.specialtyFreePlaceholder': 'Saisir la spécialité',
  'profil.referrals.backToList': '↩ Liste',
  'profil.referrals.errNameRequired': 'Nom complet requis.',
  'profil.referrals.errSpecialtyRequired': 'Spécialité requise.',
  'profil.referrals.updated': 'Confrère mis à jour.',
  'profil.referrals.added': 'Confrère ajouté.',
  'profil.referrals.saveFailed': "Échec de l'enregistrement.",
  'profil.referrals.confirmDelete': 'Supprimer {name} de votre carnet ?',
  'profil.referrals.deleted': 'Confrère supprimé.',
  'profil.referrals.deleteFailed': 'Échec de la suppression.',
  'profil.referrals.loadFailed': 'Impossible de charger le carnet de confrères.',
};

const en: Dict = {
  'profil.title': 'My profile',
  'profil.back': 'Back',

  'profil.identity.title': 'Identity',
  'profil.identity.name': 'Name:',
  'profil.identity.email': 'Email:',
  'profil.identity.roles': 'Roles:',

  'profil.signatureNote':
    'The scanned signature is only used by doctors (on the prescriptions, certificates and vaccination booklets they generate).',

  'profil.templates.rx.title': 'My prescription templates',
  'profil.templates.rx.hint':
    'Personal templates reusable in consultation (medication, lab tests, imaging).',
  'profil.templates.soap.title': 'My consultation templates (SOAP)',
  'profil.templates.soap.hint':
    'Pre-fill the Subjective / Objective / Assessment / Plan sections from the consultation screen.',
  'profil.templates.letter.title': 'My referral letter templates',
  'profil.templates.letter.hint':
    'Personal templates (title + content) to pre-fill a letter addressed to a colleague.',

  'profil.photo.title': 'Profile photo',
  'profil.photo.hint':
    'Shown in the internal messaging instead of your initials. JPEG, PNG, WebP or HEIC — 2 MB max.',
  'profil.photo.alt': 'Your profile photo',
  'profil.photo.replace': 'Replace photo',
  'profil.photo.upload': 'Upload a photo',
  'profil.photo.remove': 'Remove',
  'profil.photo.tooLarge': 'Photo too large (max 2 MB).',
  'profil.photo.updated': 'Photo updated.',
  'profil.photo.unsupported': 'Unsupported format',
  'profil.photo.unsupportedDesc': 'Accepted: JPEG, PNG, WebP, HEIC.',
  'profil.photo.uploadFailed': 'Upload failed.',
  'profil.photo.removed': 'Photo removed.',
  'profil.photo.removeFailed': 'Deletion failed.',

  'profil.password.title': 'Password',
  'profil.password.hint':
    'Change your password at any time. You will stay logged in to this session.',
  'profil.password.current': 'Current password',
  'profil.password.new': 'New password',
  'profil.password.minHint': '12 characters minimum.',
  'profil.password.confirm': 'Confirm',
  'profil.password.submit': 'Update',
  'profil.password.saving': 'Saving…',
  'profil.password.errCurrentRequired': 'The current password is required.',
  'profil.password.errTooShort': 'The new password must be at least 12 characters.',
  'profil.password.errMismatch': 'The two passwords do not match.',
  'profil.password.errSameAsCurrent': 'The new password must be different from the current one.',
  'profil.password.errInvalidCurrent': 'The current password is incorrect.',
  'profil.password.updated': 'Password updated.',

  'profil.lunch.title': 'My lunch break',
  'profil.lunch.hint':
    'During this window, no appointment can be booked on your agenda (every working day).',
  'profil.lunch.loading': 'Loading…',
  'profil.lunch.start': 'Start',
  'profil.lunch.end': 'End',
  'profil.lunch.save': 'Save',
  'profil.lunch.saving': 'Saving…',
  'profil.lunch.remove': 'Remove',
  'profil.lunch.errEndAfterStart': 'The end time must be after the start time.',
  'profil.lunch.saved': 'Lunch break saved.',
  'profil.lunch.saveFailed': 'Save failed.',
  'profil.lunch.removed': 'Lunch break removed.',
  'profil.lunch.removeFailed': 'Deletion failed.',
  'profil.lunch.active': 'Active break: {start} – {end}.',
  'profil.lunch.none': 'No break configured — appointments are allowed all day.',

  'profil.referrals.title': 'My colleagues',
  'profil.referrals.hint':
    'Personal address book to refer your patients to other specialists.',
  'profil.referrals.close': 'Close',
  'profil.referrals.new': 'New colleague',
  'profil.referrals.fullName': 'Full name *',
  'profil.referrals.fullNamePlaceholder': 'Dr Hassan Cherkaoui',
  'profil.referrals.phone': 'Phone',
  'profil.referrals.phonePlaceholder': '+212 5 22 ...',
  'profil.referrals.city': 'City',
  'profil.referrals.cityPlaceholder': 'Casablanca',
  'profil.referrals.notes': 'Notes',
  'profil.referrals.notesPlaceholder':
    'Private practice, accepts CNOPS, reachable mornings only…',
  'profil.referrals.cancel': 'Cancel',
  'profil.referrals.save': 'Save',
  'profil.referrals.saving': 'Saving…',
  'profil.referrals.create': 'Create',
  'profil.referrals.creating': 'Creating…',
  'profil.referrals.specialtyLabel': 'Specialty:',
  'profil.referrals.filterBySpecialty': 'Filter by specialty',
  'profil.referrals.allSpecialties': 'All ({n})',
  'profil.referrals.loading': 'Loading…',
  'profil.referrals.emptyAll': 'No colleague recorded yet. Start with "New colleague".',
  'profil.referrals.emptySpecialty': 'No colleague for this specialty.',
  'profil.referrals.editAria': 'Edit {name}',
  'profil.referrals.edit': 'Edit',
  'profil.referrals.deleteAria': 'Delete {name}',
  'profil.referrals.specialty': 'Specialty *',
  'profil.referrals.specialtySelect': '— Select —',
  'profil.referrals.specialtyOther': 'Other… (enter)',
  'profil.referrals.specialtyFreePlaceholder': 'Enter the specialty',
  'profil.referrals.backToList': '↩ List',
  'profil.referrals.errNameRequired': 'Full name required.',
  'profil.referrals.errSpecialtyRequired': 'Specialty required.',
  'profil.referrals.updated': 'Colleague updated.',
  'profil.referrals.added': 'Colleague added.',
  'profil.referrals.saveFailed': 'Save failed.',
  'profil.referrals.confirmDelete': 'Remove {name} from your address book?',
  'profil.referrals.deleted': 'Colleague deleted.',
  'profil.referrals.deleteFailed': 'Deletion failed.',
  'profil.referrals.loadFailed': 'Could not load the colleagues address book.',
};

const ar: Dict = {
  'profil.title': 'ملفي الشخصي',
  'profil.back': 'رجوع',

  'profil.identity.title': 'الهوية',
  'profil.identity.name': 'الاسم:',
  'profil.identity.email': 'البريد الإلكتروني:',
  'profil.identity.roles': 'الأدوار:',

  'profil.signatureNote':
    'التوقيع الممسوح ضوئيًا يستخدمه الأطباء فقط (على الوصفات والشهادات ودفاتر التطعيم التي يُنشئونها).',

  'profil.templates.rx.title': 'قوالب وصفاتي',
  'profil.templates.rx.hint':
    'قوالب شخصية قابلة لإعادة الاستخدام في الاستشارة (الأدوية، التحاليل، الأشعة).',
  'profil.templates.soap.title': 'قوالب استشاراتي (SOAP)',
  'profil.templates.soap.hint':
    'تملأ مسبقًا أقسام الذاتي / الموضوعي / التحليل / الخطة من شاشة الاستشارة.',
  'profil.templates.letter.title': 'قوالب رسائلي إلى الزملاء',
  'profil.templates.letter.hint':
    'قوالب شخصية (العنوان + المحتوى) لملء رسالة موجهة إلى زميل مسبقًا.',

  'profil.photo.title': 'صورة الملف الشخصي',
  'profil.photo.hint':
    'تظهر في المراسلة الداخلية بدلًا من الأحرف الأولى من اسمك. JPEG أو PNG أو WebP أو HEIC — 2 ميغابايت كحد أقصى.',
  'profil.photo.alt': 'صورة ملفك الشخصي',
  'profil.photo.replace': 'استبدال الصورة',
  'profil.photo.upload': 'رفع صورة',
  'profil.photo.remove': 'إزالة',
  'profil.photo.tooLarge': 'الصورة كبيرة جدًا (2 ميغابايت كحد أقصى).',
  'profil.photo.updated': 'تم تحديث الصورة.',
  'profil.photo.unsupported': 'صيغة غير مدعومة',
  'profil.photo.unsupportedDesc': 'المقبول: JPEG، PNG، WebP، HEIC.',
  'profil.photo.uploadFailed': 'فشل الرفع.',
  'profil.photo.removed': 'تمت إزالة الصورة.',
  'profil.photo.removeFailed': 'فشل الحذف.',

  'profil.password.title': 'كلمة المرور',
  'profil.password.hint':
    'غيّر كلمة المرور في أي وقت. ستبقى متصلًا في هذه الجلسة.',
  'profil.password.current': 'كلمة المرور الحالية',
  'profil.password.new': 'كلمة المرور الجديدة',
  'profil.password.minHint': '12 حرفًا كحد أدنى.',
  'profil.password.confirm': 'تأكيد',
  'profil.password.submit': 'تحديث',
  'profil.password.saving': 'جارٍ الحفظ…',
  'profil.password.errCurrentRequired': 'كلمة المرور الحالية مطلوبة.',
  'profil.password.errTooShort': 'يجب أن تتكون كلمة المرور الجديدة من 12 حرفًا على الأقل.',
  'profil.password.errMismatch': 'كلمتا المرور غير متطابقتين.',
  'profil.password.errSameAsCurrent': 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.',
  'profil.password.errInvalidCurrent': 'كلمة المرور الحالية غير صحيحة.',
  'profil.password.updated': 'تم تحديث كلمة المرور.',

  'profil.lunch.title': 'استراحة الغداء',
  'profil.lunch.hint':
    'خلال هذه الفترة، لا يمكن حجز أي موعد في أجندتك (جميع أيام العمل).',
  'profil.lunch.loading': 'جارٍ التحميل…',
  'profil.lunch.start': 'البداية',
  'profil.lunch.end': 'النهاية',
  'profil.lunch.save': 'حفظ',
  'profil.lunch.saving': 'جارٍ الحفظ…',
  'profil.lunch.remove': 'إزالة',
  'profil.lunch.errEndAfterStart': 'يجب أن يكون وقت النهاية بعد وقت البداية.',
  'profil.lunch.saved': 'تم حفظ استراحة الغداء.',
  'profil.lunch.saveFailed': 'فشل الحفظ.',
  'profil.lunch.removed': 'تمت إزالة استراحة الغداء.',
  'profil.lunch.removeFailed': 'تعذّر الحذف.',
  'profil.lunch.active': 'استراحة نشطة: {start} – {end}.',
  'profil.lunch.none': 'لا توجد استراحة مُعدّة — المواعيد مسموحة طوال اليوم.',

  'profil.referrals.title': 'زملائي',
  'profil.referrals.hint':
    'دفتر شخصي لتوجيه مرضاك إلى أخصائيين آخرين.',
  'profil.referrals.close': 'إغلاق',
  'profil.referrals.new': 'زميل جديد',
  'profil.referrals.fullName': 'الاسم الكامل *',
  'profil.referrals.fullNamePlaceholder': 'د. حسن الشرقاوي',
  'profil.referrals.phone': 'الهاتف',
  'profil.referrals.phonePlaceholder': '+212 5 22 ...',
  'profil.referrals.city': 'المدينة',
  'profil.referrals.cityPlaceholder': 'الدار البيضاء',
  'profil.referrals.notes': 'ملاحظات',
  'profil.referrals.notesPlaceholder':
    'ممارسة خاصة، يقبل CNOPS، متاح صباحًا فقط…',
  'profil.referrals.cancel': 'إلغاء',
  'profil.referrals.save': 'حفظ',
  'profil.referrals.saving': 'جارٍ الحفظ…',
  'profil.referrals.create': 'إنشاء',
  'profil.referrals.creating': 'جارٍ الإنشاء…',
  'profil.referrals.specialtyLabel': 'التخصص:',
  'profil.referrals.filterBySpecialty': 'التصفية حسب التخصص',
  'profil.referrals.allSpecialties': 'الكل ({n})',
  'profil.referrals.loading': 'جارٍ التحميل…',
  'profil.referrals.emptyAll': 'لا يوجد زملاء مسجّلون بعد. ابدأ بـ «زميل جديد».',
  'profil.referrals.emptySpecialty': 'لا يوجد زملاء لهذا التخصص.',
  'profil.referrals.editAria': 'تعديل {name}',
  'profil.referrals.edit': 'تعديل',
  'profil.referrals.deleteAria': 'حذف {name}',
  'profil.referrals.specialty': 'التخصص *',
  'profil.referrals.specialtySelect': '— اختر —',
  'profil.referrals.specialtyOther': 'آخر… (إدخال)',
  'profil.referrals.specialtyFreePlaceholder': 'أدخل التخصص',
  'profil.referrals.backToList': '↩ القائمة',
  'profil.referrals.errNameRequired': 'الاسم الكامل مطلوب.',
  'profil.referrals.errSpecialtyRequired': 'التخصص مطلوب.',
  'profil.referrals.updated': 'تم تحديث الزميل.',
  'profil.referrals.added': 'تمت إضافة الزميل.',
  'profil.referrals.saveFailed': 'فشل الحفظ.',
  'profil.referrals.confirmDelete': 'حذف {name} من دفترك؟',
  'profil.referrals.deleted': 'تم حذف الزميل.',
  'profil.referrals.deleteFailed': 'فشل الحذف.',
  'profil.referrals.loadFailed': 'تعذّر تحميل دفتر الزملاء.',
};

const es: Dict = {
  'profil.title': 'Mi perfil',
  'profil.back': 'Volver',

  'profil.identity.title': 'Identidad',
  'profil.identity.name': 'Nombre:',
  'profil.identity.email': 'Correo electrónico:',
  'profil.identity.roles': 'Roles:',

  'profil.signatureNote':
    'La firma escaneada solo la usan los médicos (en las recetas, certificados y cartillas de vacunación que generan).',

  'profil.templates.rx.title': 'Mis plantillas de receta',
  'profil.templates.rx.hint':
    'Plantillas personales reutilizables en consulta (medicamentos, análisis, imagenología).',
  'profil.templates.soap.title': 'Mis plantillas de consulta (SOAP)',
  'profil.templates.soap.hint':
    'Rellenan previamente las secciones Subjetivo / Objetivo / Análisis / Plan desde la pantalla de consulta.',
  'profil.templates.letter.title': 'Mis plantillas de carta a colegas',
  'profil.templates.letter.hint':
    'Plantillas personales (título + contenido) para rellenar previamente una carta dirigida a un colega.',

  'profil.photo.title': 'Foto de perfil',
  'profil.photo.hint':
    'Visible en la mensajería interna en lugar de tus iniciales. JPEG, PNG, WebP o HEIC — 2 MB máx.',
  'profil.photo.alt': 'Tu foto de perfil',
  'profil.photo.replace': 'Reemplazar la foto',
  'profil.photo.upload': 'Subir una foto',
  'profil.photo.remove': 'Quitar',
  'profil.photo.tooLarge': 'Foto demasiado grande (máx. 2 MB).',
  'profil.photo.updated': 'Foto actualizada.',
  'profil.photo.unsupported': 'Formato no compatible',
  'profil.photo.unsupportedDesc': 'Aceptados: JPEG, PNG, WebP, HEIC.',
  'profil.photo.uploadFailed': 'Error al subir.',
  'profil.photo.removed': 'Foto quitada.',
  'profil.photo.removeFailed': 'Error al eliminar.',

  'profil.password.title': 'Contraseña',
  'profil.password.hint':
    'Cambia tu contraseña en cualquier momento. Permanecerás conectado en esta sesión.',
  'profil.password.current': 'Contraseña actual',
  'profil.password.new': 'Nueva contraseña',
  'profil.password.minHint': '12 caracteres mínimo.',
  'profil.password.confirm': 'Confirmar',
  'profil.password.submit': 'Actualizar',
  'profil.password.saving': 'Guardando…',
  'profil.password.errCurrentRequired': 'La contraseña actual es obligatoria.',
  'profil.password.errTooShort': 'La nueva contraseña debe tener al menos 12 caracteres.',
  'profil.password.errMismatch': 'Las dos contraseñas no coinciden.',
  'profil.password.errSameAsCurrent': 'La nueva contraseña debe ser distinta de la actual.',
  'profil.password.errInvalidCurrent': 'La contraseña actual es incorrecta.',
  'profil.password.updated': 'Contraseña actualizada.',

  'profil.lunch.title': 'Mi pausa para comer',
  'profil.lunch.hint':
    'Durante esta franja, no se puede reservar ninguna cita en tu agenda (todos los días laborables).',
  'profil.lunch.loading': 'Cargando…',
  'profil.lunch.start': 'Inicio',
  'profil.lunch.end': 'Fin',
  'profil.lunch.save': 'Guardar',
  'profil.lunch.saving': 'Guardando…',
  'profil.lunch.remove': 'Quitar',
  'profil.lunch.errEndAfterStart': 'La hora de fin debe ser posterior a la hora de inicio.',
  'profil.lunch.saved': 'Pausa para comer guardada.',
  'profil.lunch.saveFailed': 'Error al guardar.',
  'profil.lunch.removed': 'Pausa para comer quitada.',
  'profil.lunch.removeFailed': 'No se pudo eliminar.',
  'profil.lunch.active': 'Pausa activa: {start} – {end}.',
  'profil.lunch.none': 'Ninguna pausa configurada — las citas se permiten todo el día.',

  'profil.referrals.title': 'Mis colegas',
  'profil.referrals.hint':
    'Agenda personal para derivar a tus pacientes a otros especialistas.',
  'profil.referrals.close': 'Cerrar',
  'profil.referrals.new': 'Nuevo colega',
  'profil.referrals.fullName': 'Nombre completo *',
  'profil.referrals.fullNamePlaceholder': 'Dr. Hassan Cherkaoui',
  'profil.referrals.phone': 'Teléfono',
  'profil.referrals.phonePlaceholder': '+212 5 22 ...',
  'profil.referrals.city': 'Ciudad',
  'profil.referrals.cityPlaceholder': 'Casablanca',
  'profil.referrals.notes': 'Notas',
  'profil.referrals.notesPlaceholder':
    'Práctica privada, acepta CNOPS, localizable solo por las mañanas…',
  'profil.referrals.cancel': 'Cancelar',
  'profil.referrals.save': 'Guardar',
  'profil.referrals.saving': 'Guardando…',
  'profil.referrals.create': 'Crear',
  'profil.referrals.creating': 'Creando…',
  'profil.referrals.specialtyLabel': 'Especialidad:',
  'profil.referrals.filterBySpecialty': 'Filtrar por especialidad',
  'profil.referrals.allSpecialties': 'Todas ({n})',
  'profil.referrals.loading': 'Cargando…',
  'profil.referrals.emptyAll': 'Ningún colega registrado aún. Empieza por «Nuevo colega».',
  'profil.referrals.emptySpecialty': 'Ningún colega para esta especialidad.',
  'profil.referrals.editAria': 'Editar {name}',
  'profil.referrals.edit': 'Editar',
  'profil.referrals.deleteAria': 'Eliminar {name}',
  'profil.referrals.specialty': 'Especialidad *',
  'profil.referrals.specialtySelect': '— Seleccionar —',
  'profil.referrals.specialtyOther': 'Otra… (escribir)',
  'profil.referrals.specialtyFreePlaceholder': 'Escribir la especialidad',
  'profil.referrals.backToList': '↩ Lista',
  'profil.referrals.errNameRequired': 'Nombre completo obligatorio.',
  'profil.referrals.errSpecialtyRequired': 'Especialidad obligatoria.',
  'profil.referrals.updated': 'Colega actualizado.',
  'profil.referrals.added': 'Colega añadido.',
  'profil.referrals.saveFailed': 'Error al guardar.',
  'profil.referrals.confirmDelete': '¿Eliminar a {name} de tu agenda?',
  'profil.referrals.deleted': 'Colega eliminado.',
  'profil.referrals.deleteFailed': 'Error al eliminar.',
  'profil.referrals.loadFailed': 'No se pudo cargar la agenda de colegas.',
};

export const profilMessages: Record<Lang, Dict> = { fr, en, ar, es };
