/**
 * Traductions (#122) — module Catalogue (médicaments / analyses biologiques /
 * radio-imagerie + import CSV ; desktop + mobile).
 *
 * Module séparé fusionné dans `MESSAGES` (voir lib/i18n/messages.ts). `fr` est la
 * langue de référence (jeu de clés complet) ; chaque clé `fr` DOIT exister en
 * en/ar/es (test de parité CI). ar/es à faire relire par un locuteur natif avant
 * prod — fonctionnelles mais non certifiées linguistiquement.
 *
 * Ne sont PAS traduits : noms de catalogue (data), DCI, codes, MAD, libellés de
 * modalité technique (RADIO/ECHO/SCANNER/IRM), exemples de saisie qui citent des
 * données réelles.
 */
import type { Dict, Lang } from '@/lib/i18n/index';

const fr: Dict = {
  // ── Onglets ───────────────────────────────────────────────────────────────
  'cat.tabsAria': 'Catalogues',
  'cat.tab.medicaments': 'Médicaments',
  'cat.tab.analyses': 'Analyses',
  'cat.tab.radio': 'Radio / Imagerie',

  // ── Médicaments : en-tête + actions ──────────────────────────────────────
  'cat.med.title': 'Catalogue médicaments',
  'cat.med.sub': '{n} entrée commercialisée au Maroc',
  'cat.med.sub_plural': '{n} entrées commercialisées au Maroc',
  'cat.add': 'Ajouter',

  // ── Médicaments : filtres ─────────────────────────────────────────────────
  'cat.med.searchPlaceholder': 'Rechercher par nom commercial ou DCI…',
  'cat.med.searchAria': 'Rechercher un médicament',
  'cat.med.allClasses': 'Toutes les classes',
  'cat.med.classAria': 'Classe pharmacologique',
  'cat.reset': 'Réinitialiser',

  // ── Médicaments : tableau ─────────────────────────────────────────────────
  'cat.med.col.dciName': 'DCI / Nom commercial',
  'cat.med.col.form': 'Forme',
  'cat.med.col.dosage': 'Dosage',
  'cat.med.col.class': 'Classe',
  'cat.med.col.internalPrice': 'Prix interne',
  'cat.med.empty': 'Aucun médicament ne correspond à la recherche.',
  'cat.med.emptyShort': 'Aucun médicament ne correspond.',
  'cat.favoriteAria': 'Favori',
  'cat.med.favoritePill': 'Favori',
  'cat.med.favoriteRowAria': 'Médicament favori',

  // ── Médicaments : drawer / formulaire ─────────────────────────────────────
  'cat.med.drawer.edit': 'Modifier le médicament',
  'cat.med.drawer.new': 'Nouveau médicament',
  'cat.med.field.commercialName': 'Nom commercial *',
  'cat.med.field.commercialName.ph': 'ex. Doliprane',
  'cat.med.field.dci': 'DCI (molécule) *',
  'cat.med.field.dci.ph': 'ex. Paracétamol',
  'cat.med.field.form': 'Forme *',
  'cat.med.field.form.ph': 'comprimé, sirop, gélule…',
  'cat.med.field.dosage': 'Dosage *',
  'cat.med.field.dosage.ph': '500mg, 10mg/ml…',
  'cat.med.field.class': 'Classe pharmacologique',
  'cat.med.field.class.ph': 'ex. ains, ipp, antalgique, penicillines…',
  'cat.med.field.class.hint':
    'Sert au contrôle des allergies (les substances déclarées chez le patient sont matchées sur ce tag).',
  'cat.med.field.favorite': 'Marquer comme favori (apparaît en haut des suggestions)',
  'cat.med.field.internalPrice': 'Prix de cession en interne (MAD)',
  'cat.med.field.internalPrice.ph': 'ex. 45.00 — vide = non facturable en interne',
  'cat.med.field.internalPrice.hint':
    'Si renseigné, ce prix est ajouté à la facture de consultation quand le médecin coche « fournir en interne » à la prescription.',
  'cat.med.submit.new': 'Ajouter au catalogue',
  'cat.med.submit.edit': 'Enregistrer',

  // ── Médicaments : validation / toasts ─────────────────────────────────────
  'cat.med.loadError': 'Impossible de charger le catalogue.',
  'cat.med.required': 'Champs requis : Nom commercial, DCI, Forme, Dosage.',
  'cat.med.updated': 'Médicament mis à jour.',
  'cat.med.added': 'Médicament ajouté au catalogue.',
  'cat.med.deactivated': 'Médicament désactivé.',
  'cat.med.confirmDeactivate': 'Désactiver « {name} {dosage} » du catalogue ?',
  'cat.med.deleteAria': 'Supprimer {name}',

  // ── Analyses : en-tête ────────────────────────────────────────────────────
  'cat.lab.title': 'Catalogue analyses',
  'cat.lab.sub': '{n} analyse',
  'cat.lab.sub_plural': '{n} analyses',

  // ── Analyses : filtres ────────────────────────────────────────────────────
  'cat.lab.searchPlaceholder': 'Rechercher par nom ou code…',
  'cat.lab.searchAria': 'Rechercher une analyse',
  'cat.lab.allCategories': 'Toutes les catégories',
  'cat.lab.categoryAria': "Catégorie d'analyse",

  // ── Analyses : tableau ────────────────────────────────────────────────────
  'cat.lab.col.code': 'Code',
  'cat.lab.col.name': 'Nom',
  'cat.lab.col.category': 'Catégorie',
  'cat.lab.col.internalPrice': 'Prix interne',
  'cat.lab.empty': 'Aucune analyse ne correspond à la recherche.',
  'cat.lab.emptyShort': 'Aucune analyse ne correspond.',

  // ── Analyses : drawer / formulaire ────────────────────────────────────────
  'cat.lab.drawer.edit': "Modifier l'analyse",
  'cat.lab.drawer.new': 'Nouvelle analyse',
  'cat.lab.field.code': 'Code *',
  'cat.lab.field.code.ph': 'ex. NFS, CRP, GLY-VEIN…',
  'cat.lab.field.code.hint': 'Identifiant unique servant aux prescriptions.',
  'cat.lab.field.name': 'Nom *',
  'cat.lab.field.name.ph': 'ex. Numération formule sanguine',
  'cat.lab.field.category': 'Catégorie',
  'cat.lab.field.category.ph': 'Hématologie, Bactériologie, Biochimie…',
  'cat.lab.field.internalPrice': 'Prix interne (MAD)',
  'cat.lab.field.internalPrice.ph': 'ex. 120 — laisser vide = non facturable en interne',
  'cat.lab.field.internalPrice.hint':
    "V050 — Quand le médecin coche 'Réaliser en interne' et signe la consultation, cette ligne est ajoutée automatiquement à la facture brouillon du patient. Laisser vide pour ne pas facturer automatiquement.",
  'cat.lab.submit.new': 'Ajouter au catalogue',
  'cat.lab.submit.edit': 'Enregistrer',

  // ── Analyses : validation / toasts ────────────────────────────────────────
  'cat.lab.loadError': 'Impossible de charger les analyses.',
  'cat.lab.required': 'Champs requis : Code, Nom.',
  'cat.lab.updated': 'Analyse mise à jour.',
  'cat.lab.added': 'Analyse ajoutée au catalogue.',
  'cat.lab.deactivated': 'Analyse désactivée.',
  'cat.lab.confirmDeactivate': "Désactiver l'analyse « {name} » du catalogue ?",
  'cat.lab.deleteAria': 'Supprimer {name}',

  // ── Imagerie : en-tête ────────────────────────────────────────────────────
  'cat.img.title': 'Catalogue radio / imagerie',
  'cat.img.sub': '{n} examen',
  'cat.img.sub_plural': '{n} examens',

  // ── Imagerie : filtres ────────────────────────────────────────────────────
  'cat.img.searchPlaceholder': 'Rechercher par nom ou code…',
  'cat.img.searchAria': "Rechercher un examen d'imagerie",
  'cat.img.allModalities': 'Toutes les modalités',
  'cat.img.modalityAria': 'Modalité',

  // ── Imagerie : tableau ────────────────────────────────────────────────────
  'cat.img.col.code': 'Code',
  'cat.img.col.name': 'Nom',
  'cat.img.col.modality': 'Modalité',
  'cat.img.col.internalPrice': 'Prix interne',
  'cat.img.empty': 'Aucun examen ne correspond à la recherche.',
  'cat.img.emptyShort': 'Aucun examen ne correspond.',

  // ── Imagerie : drawer / formulaire ────────────────────────────────────────
  'cat.img.drawer.edit': "Modifier l'examen",
  'cat.img.drawer.new': 'Nouvel examen',
  'cat.img.field.code': 'Code *',
  'cat.img.field.code.ph': 'ex. RX-THX, ECHO-ABD…',
  'cat.img.field.code.hint': 'Identifiant unique servant aux prescriptions.',
  'cat.img.field.name': 'Nom *',
  'cat.img.field.name.ph': 'ex. Radio thorax face',
  'cat.img.field.modality': 'Modalité',
  'cat.img.field.modality.other': '— Autre —',
  'cat.img.field.internalPrice': 'Prix interne (MAD)',
  'cat.img.field.internalPrice.ph': 'ex. 250 — laisser vide = non facturable en interne',
  'cat.img.field.internalPrice.hint':
    'V050 — Quand le médecin coche « Réaliser en interne » et signe la consultation, cette ligne est ajoutée automatiquement à la facture brouillon du patient. Laisser vide pour ne pas facturer automatiquement.',
  'cat.img.submit.new': 'Ajouter au catalogue',
  'cat.img.submit.edit': 'Enregistrer',

  // ── Imagerie : validation / toasts ────────────────────────────────────────
  'cat.img.loadError': "Impossible de charger les examens d'imagerie.",
  'cat.img.required': 'Champs requis : Code, Nom.',
  'cat.img.updated': 'Examen mis à jour.',
  'cat.img.added': 'Examen ajouté au catalogue.',
  'cat.img.deactivated': 'Examen désactivé.',
  'cat.img.confirmDeactivate': "Désactiver l'examen « {name} » du catalogue ?",
  'cat.img.deleteAria': 'Supprimer {name}',

  // ── Partagé : prix / erreurs CRUD ─────────────────────────────────────────
  'cat.price.invalid': 'Prix interne invalide.',
  'cat.code.taken': 'Ce code est déjà utilisé.',
  'cat.permissionDenied': 'Permission refusée (rôle MEDECIN ou ADMIN requis).',
  'cat.saveError': "Échec de l'enregistrement.",
  'cat.deleteError': 'Suppression impossible.',
  'cat.other': 'Autres',

  // ── Mobile : en-têtes courts + retour ─────────────────────────────────────
  'cat.back': 'Retour',
  'cat.mobile.medTitle': 'Catalogue',
  'cat.mobile.labTitle': 'Analyses',
  'cat.mobile.imgTitle': 'Radio / Imagerie',
  'cat.mobile.sub': '{n} entrée',
  'cat.mobile.sub_plural': '{n} entrées',
  'cat.mobile.medManageNote':
    'La gestion du catalogue (ajout / modification) se fait depuis la version desktop par un médecin ou un administrateur.',
  'cat.mobile.readonlyNote':
    "Référentiel en lecture seule. La gestion (ajout, désactivation) sera activée dès que le backend l'expose.",

  // ── Import CSV ────────────────────────────────────────────────────────────
  'cat.import.button': 'Importer CSV',
  'cat.import.busy': 'Import…',
  'cat.import.fileAria': 'Importer un fichier CSV ({kind})',
  'cat.import.title': 'CSV UTF-8 — colonnes : {headers}',
  'cat.import.ok': 'Import OK — {added} ajouté, {updated} mis à jour.',
  'cat.import.ok_plural': 'Import OK — {added} ajoutés, {updated} mis à jour.',
  'cat.import.partial':
    'Import partiel — {added} ajouté(s), {updated} mis à jour, {skipped} ignoré(s).',
  'cat.import.forbidden': "Vous n'avez pas le droit d'importer le catalogue.",
  'cat.import.rejected': 'Fichier rejeté.',
  'cat.import.error': "Échec de l'import.",
};

const en: Dict = {
  'cat.tabsAria': 'Catalogues',
  'cat.tab.medicaments': 'Medications',
  'cat.tab.analyses': 'Lab tests',
  'cat.tab.radio': 'Radiology / Imaging',

  'cat.med.title': 'Medication catalogue',
  'cat.med.sub': '{n} entry marketed in Morocco',
  'cat.med.sub_plural': '{n} entries marketed in Morocco',
  'cat.add': 'Add',

  'cat.med.searchPlaceholder': 'Search by brand name or INN…',
  'cat.med.searchAria': 'Search a medication',
  'cat.med.allClasses': 'All classes',
  'cat.med.classAria': 'Pharmacological class',
  'cat.reset': 'Reset',

  'cat.med.col.dciName': 'INN / Brand name',
  'cat.med.col.form': 'Form',
  'cat.med.col.dosage': 'Dosage',
  'cat.med.col.class': 'Class',
  'cat.med.col.internalPrice': 'Internal price',
  'cat.med.empty': 'No medication matches the search.',
  'cat.med.emptyShort': 'No medication matches.',
  'cat.favoriteAria': 'Favorite',
  'cat.med.favoritePill': 'Favorite',
  'cat.med.favoriteRowAria': 'Favorite medication',

  'cat.med.drawer.edit': 'Edit medication',
  'cat.med.drawer.new': 'New medication',
  'cat.med.field.commercialName': 'Brand name *',
  'cat.med.field.commercialName.ph': 'e.g. Doliprane',
  'cat.med.field.dci': 'INN (molecule) *',
  'cat.med.field.dci.ph': 'e.g. Paracetamol',
  'cat.med.field.form': 'Form *',
  'cat.med.field.form.ph': 'tablet, syrup, capsule…',
  'cat.med.field.dosage': 'Dosage *',
  'cat.med.field.dosage.ph': '500mg, 10mg/ml…',
  'cat.med.field.class': 'Pharmacological class',
  'cat.med.field.class.ph': 'e.g. nsaid, ppi, analgesic, penicillins…',
  'cat.med.field.class.hint':
    'Used for allergy checking (substances declared for the patient are matched against this tag).',
  'cat.med.field.favorite': 'Mark as favorite (appears at the top of suggestions)',
  'cat.med.field.internalPrice': 'Internal dispensing price (MAD)',
  'cat.med.field.internalPrice.ph': 'e.g. 45.00 — empty = not billable internally',
  'cat.med.field.internalPrice.hint':
    'If set, this price is added to the consultation invoice when the doctor ticks "dispense internally" on the prescription.',
  'cat.med.submit.new': 'Add to catalogue',
  'cat.med.submit.edit': 'Save',

  'cat.med.loadError': 'Unable to load the catalogue.',
  'cat.med.required': 'Required fields: Brand name, INN, Form, Dosage.',
  'cat.med.updated': 'Medication updated.',
  'cat.med.added': 'Medication added to the catalogue.',
  'cat.med.deactivated': 'Medication deactivated.',
  'cat.med.confirmDeactivate': 'Deactivate "{name} {dosage}" from the catalogue?',
  'cat.med.deleteAria': 'Delete {name}',

  'cat.lab.title': 'Lab test catalogue',
  'cat.lab.sub': '{n} test',
  'cat.lab.sub_plural': '{n} tests',

  'cat.lab.searchPlaceholder': 'Search by name or code…',
  'cat.lab.searchAria': 'Search a lab test',
  'cat.lab.allCategories': 'All categories',
  'cat.lab.categoryAria': 'Test category',

  'cat.lab.col.code': 'Code',
  'cat.lab.col.name': 'Name',
  'cat.lab.col.category': 'Category',
  'cat.lab.col.internalPrice': 'Internal price',
  'cat.lab.empty': 'No test matches the search.',
  'cat.lab.emptyShort': 'No test matches.',

  'cat.lab.drawer.edit': 'Edit test',
  'cat.lab.drawer.new': 'New test',
  'cat.lab.field.code': 'Code *',
  'cat.lab.field.code.ph': 'e.g. CBC, CRP, GLY-VEIN…',
  'cat.lab.field.code.hint': 'Unique identifier used in prescriptions.',
  'cat.lab.field.name': 'Name *',
  'cat.lab.field.name.ph': 'e.g. Complete blood count',
  'cat.lab.field.category': 'Category',
  'cat.lab.field.category.ph': 'Hematology, Bacteriology, Biochemistry…',
  'cat.lab.field.internalPrice': 'Internal price (MAD)',
  'cat.lab.field.internalPrice.ph': 'e.g. 120 — leave empty = not billable internally',
  'cat.lab.field.internalPrice.hint':
    'V050 — When the doctor ticks "Perform internally" and signs the consultation, this line is automatically added to the patient\'s draft invoice. Leave empty to skip automatic billing.',
  'cat.lab.submit.new': 'Add to catalogue',
  'cat.lab.submit.edit': 'Save',

  'cat.lab.loadError': 'Unable to load the lab tests.',
  'cat.lab.required': 'Required fields: Code, Name.',
  'cat.lab.updated': 'Test updated.',
  'cat.lab.added': 'Test added to the catalogue.',
  'cat.lab.deactivated': 'Test deactivated.',
  'cat.lab.confirmDeactivate': 'Deactivate the test "{name}" from the catalogue?',
  'cat.lab.deleteAria': 'Delete {name}',

  'cat.img.title': 'Radiology / imaging catalogue',
  'cat.img.sub': '{n} exam',
  'cat.img.sub_plural': '{n} exams',

  'cat.img.searchPlaceholder': 'Search by name or code…',
  'cat.img.searchAria': 'Search an imaging exam',
  'cat.img.allModalities': 'All modalities',
  'cat.img.modalityAria': 'Modality',

  'cat.img.col.code': 'Code',
  'cat.img.col.name': 'Name',
  'cat.img.col.modality': 'Modality',
  'cat.img.col.internalPrice': 'Internal price',
  'cat.img.empty': 'No exam matches the search.',
  'cat.img.emptyShort': 'No exam matches.',

  'cat.img.drawer.edit': 'Edit exam',
  'cat.img.drawer.new': 'New exam',
  'cat.img.field.code': 'Code *',
  'cat.img.field.code.ph': 'e.g. RX-THX, ECHO-ABD…',
  'cat.img.field.code.hint': 'Unique identifier used in prescriptions.',
  'cat.img.field.name': 'Name *',
  'cat.img.field.name.ph': 'e.g. Chest X-ray frontal',
  'cat.img.field.modality': 'Modality',
  'cat.img.field.modality.other': '— Other —',
  'cat.img.field.internalPrice': 'Internal price (MAD)',
  'cat.img.field.internalPrice.ph': 'e.g. 250 — leave empty = not billable internally',
  'cat.img.field.internalPrice.hint':
    'V050 — When the doctor ticks "Perform internally" and signs the consultation, this line is automatically added to the patient\'s draft invoice. Leave empty to skip automatic billing.',
  'cat.img.submit.new': 'Add to catalogue',
  'cat.img.submit.edit': 'Save',

  'cat.img.loadError': 'Unable to load the imaging exams.',
  'cat.img.required': 'Required fields: Code, Name.',
  'cat.img.updated': 'Exam updated.',
  'cat.img.added': 'Exam added to the catalogue.',
  'cat.img.deactivated': 'Exam deactivated.',
  'cat.img.confirmDeactivate': 'Deactivate the exam "{name}" from the catalogue?',
  'cat.img.deleteAria': 'Delete {name}',

  'cat.price.invalid': 'Invalid internal price.',
  'cat.code.taken': 'This code is already in use.',
  'cat.permissionDenied': 'Permission denied (MEDECIN or ADMIN role required).',
  'cat.saveError': 'Failed to save.',
  'cat.deleteError': 'Unable to delete.',
  'cat.other': 'Other',

  'cat.back': 'Back',
  'cat.mobile.medTitle': 'Catalogue',
  'cat.mobile.labTitle': 'Lab tests',
  'cat.mobile.imgTitle': 'Radiology / Imaging',
  'cat.mobile.sub': '{n} entry',
  'cat.mobile.sub_plural': '{n} entries',
  'cat.mobile.medManageNote':
    'Catalogue management (add / edit) is done from the desktop version by a doctor or an administrator.',
  'cat.mobile.readonlyNote':
    'Read-only reference list. Management (add, deactivate) will be enabled once the backend exposes it.',

  'cat.import.button': 'Import CSV',
  'cat.import.busy': 'Importing…',
  'cat.import.fileAria': 'Import a CSV file ({kind})',
  'cat.import.title': 'UTF-8 CSV — columns: {headers}',
  'cat.import.ok': 'Import OK — {added} added, {updated} updated.',
  'cat.import.ok_plural': 'Import OK — {added} added, {updated} updated.',
  'cat.import.partial':
    'Partial import — {added} added, {updated} updated, {skipped} skipped.',
  'cat.import.forbidden': 'You are not allowed to import the catalogue.',
  'cat.import.rejected': 'File rejected.',
  'cat.import.error': 'Import failed.',
};

const ar: Dict = {
  'cat.tabsAria': 'الفهارس',
  'cat.tab.medicaments': 'الأدوية',
  'cat.tab.analyses': 'التحاليل',
  'cat.tab.radio': 'الأشعة / التصوير',

  'cat.med.title': 'فهرس الأدوية',
  'cat.med.sub': '{n} مُدخَل مُسوَّق في المغرب',
  'cat.med.sub_plural': '{n} مُدخَلات مُسوَّقة في المغرب',
  'cat.add': 'إضافة',

  'cat.med.searchPlaceholder': 'ابحث بالاسم التجاري أو الاسم العلمي…',
  'cat.med.searchAria': 'البحث عن دواء',
  'cat.med.allClasses': 'جميع الفئات',
  'cat.med.classAria': 'الفئة الدوائية',
  'cat.reset': 'إعادة تعيين',

  'cat.med.col.dciName': 'الاسم العلمي / الاسم التجاري',
  'cat.med.col.form': 'الشكل',
  'cat.med.col.dosage': 'الجرعة',
  'cat.med.col.class': 'الفئة',
  'cat.med.col.internalPrice': 'السعر الداخلي',
  'cat.med.empty': 'لا يوجد دواء يطابق البحث.',
  'cat.med.emptyShort': 'لا يوجد دواء مطابق.',
  'cat.favoriteAria': 'مفضّل',
  'cat.med.favoritePill': 'مفضّل',
  'cat.med.favoriteRowAria': 'دواء مفضّل',

  'cat.med.drawer.edit': 'تعديل الدواء',
  'cat.med.drawer.new': 'دواء جديد',
  'cat.med.field.commercialName': 'الاسم التجاري *',
  'cat.med.field.commercialName.ph': 'مثال: Doliprane',
  'cat.med.field.dci': 'الاسم العلمي (الجزيء) *',
  'cat.med.field.dci.ph': 'مثال: Paracétamol',
  'cat.med.field.form': 'الشكل *',
  'cat.med.field.form.ph': 'أقراص، شراب، كبسولة…',
  'cat.med.field.dosage': 'الجرعة *',
  'cat.med.field.dosage.ph': '500mg، 10mg/ml…',
  'cat.med.field.class': 'الفئة الدوائية',
  'cat.med.field.class.ph': 'مثال: ains، ipp، antalgique، penicillines…',
  'cat.med.field.class.hint':
    'تُستعمل لمراقبة الحساسية (تُطابَق المواد المُصرَّح بها لدى المريض مع هذا الوسم).',
  'cat.med.field.favorite': 'تحديد كمفضّل (يظهر في أعلى الاقتراحات)',
  'cat.med.field.internalPrice': 'سعر التوزيع الداخلي (درهم)',
  'cat.med.field.internalPrice.ph': 'مثال: 45.00 — فارغ = غير قابل للفوترة داخليًا',
  'cat.med.field.internalPrice.hint':
    'إذا حُدِّد، يُضاف هذا السعر إلى فاتورة الاستشارة عندما يحدّد الطبيب «التوفير داخليًا» في الوصفة.',
  'cat.med.submit.new': 'إضافة إلى الفهرس',
  'cat.med.submit.edit': 'حفظ',

  'cat.med.loadError': 'تعذّر تحميل الفهرس.',
  'cat.med.required': 'الحقول المطلوبة: الاسم التجاري، الاسم العلمي، الشكل، الجرعة.',
  'cat.med.updated': 'تم تحديث الدواء.',
  'cat.med.added': 'تمت إضافة الدواء إلى الفهرس.',
  'cat.med.deactivated': 'تم تعطيل الدواء.',
  'cat.med.confirmDeactivate': 'تعطيل «{name} {dosage}» من الفهرس؟',
  'cat.med.deleteAria': 'حذف {name}',

  'cat.lab.title': 'فهرس التحاليل',
  'cat.lab.sub': '{n} تحليل',
  'cat.lab.sub_plural': '{n} تحاليل',

  'cat.lab.searchPlaceholder': 'ابحث بالاسم أو الرمز…',
  'cat.lab.searchAria': 'البحث عن تحليل',
  'cat.lab.allCategories': 'جميع الفئات',
  'cat.lab.categoryAria': 'فئة التحليل',

  'cat.lab.col.code': 'الرمز',
  'cat.lab.col.name': 'الاسم',
  'cat.lab.col.category': 'الفئة',
  'cat.lab.col.internalPrice': 'السعر الداخلي',
  'cat.lab.empty': 'لا يوجد تحليل يطابق البحث.',
  'cat.lab.emptyShort': 'لا يوجد تحليل مطابق.',

  'cat.lab.drawer.edit': 'تعديل التحليل',
  'cat.lab.drawer.new': 'تحليل جديد',
  'cat.lab.field.code': 'الرمز *',
  'cat.lab.field.code.ph': 'مثال: NFS، CRP، GLY-VEIN…',
  'cat.lab.field.code.hint': 'مُعرّف فريد يُستعمل في الوصفات.',
  'cat.lab.field.name': 'الاسم *',
  'cat.lab.field.name.ph': 'مثال: تعداد الدم الكامل',
  'cat.lab.field.category': 'الفئة',
  'cat.lab.field.category.ph': 'أمراض الدم، علم الجراثيم، الكيمياء الحيوية…',
  'cat.lab.field.internalPrice': 'السعر الداخلي (درهم)',
  'cat.lab.field.internalPrice.ph': 'مثال: 120 — اتركه فارغًا = غير قابل للفوترة داخليًا',
  'cat.lab.field.internalPrice.hint':
    'V050 — عندما يحدّد الطبيب «الإنجاز داخليًا» ويوقّع الاستشارة، يُضاف هذا السطر تلقائيًا إلى مسودة فاتورة المريض. اتركه فارغًا لتجنّب الفوترة التلقائية.',
  'cat.lab.submit.new': 'إضافة إلى الفهرس',
  'cat.lab.submit.edit': 'حفظ',

  'cat.lab.loadError': 'تعذّر تحميل التحاليل.',
  'cat.lab.required': 'الحقول المطلوبة: الرمز، الاسم.',
  'cat.lab.updated': 'تم تحديث التحليل.',
  'cat.lab.added': 'تمت إضافة التحليل إلى الفهرس.',
  'cat.lab.deactivated': 'تم تعطيل التحليل.',
  'cat.lab.confirmDeactivate': 'تعطيل التحليل «{name}» من الفهرس؟',
  'cat.lab.deleteAria': 'حذف {name}',

  'cat.img.title': 'فهرس الأشعة / التصوير',
  'cat.img.sub': '{n} فحص',
  'cat.img.sub_plural': '{n} فحوص',

  'cat.img.searchPlaceholder': 'ابحث بالاسم أو الرمز…',
  'cat.img.searchAria': 'البحث عن فحص تصويري',
  'cat.img.allModalities': 'جميع الأنماط',
  'cat.img.modalityAria': 'النمط',

  'cat.img.col.code': 'الرمز',
  'cat.img.col.name': 'الاسم',
  'cat.img.col.modality': 'النمط',
  'cat.img.col.internalPrice': 'السعر الداخلي',
  'cat.img.empty': 'لا يوجد فحص يطابق البحث.',
  'cat.img.emptyShort': 'لا يوجد فحص مطابق.',

  'cat.img.drawer.edit': 'تعديل الفحص',
  'cat.img.drawer.new': 'فحص جديد',
  'cat.img.field.code': 'الرمز *',
  'cat.img.field.code.ph': 'مثال: RX-THX، ECHO-ABD…',
  'cat.img.field.code.hint': 'مُعرّف فريد يُستعمل في الوصفات.',
  'cat.img.field.name': 'الاسم *',
  'cat.img.field.name.ph': 'مثال: أشعة الصدر الأمامية',
  'cat.img.field.modality': 'النمط',
  'cat.img.field.modality.other': '— أخرى —',
  'cat.img.field.internalPrice': 'السعر الداخلي (درهم)',
  'cat.img.field.internalPrice.ph': 'مثال: 250 — اتركه فارغًا = غير قابل للفوترة داخليًا',
  'cat.img.field.internalPrice.hint':
    'V050 — عندما يحدّد الطبيب «الإنجاز داخليًا» ويوقّع الاستشارة، يُضاف هذا السطر تلقائيًا إلى مسودة فاتورة المريض. اتركه فارغًا لتجنّب الفوترة التلقائية.',
  'cat.img.submit.new': 'إضافة إلى الفهرس',
  'cat.img.submit.edit': 'حفظ',

  'cat.img.loadError': 'تعذّر تحميل فحوص التصوير.',
  'cat.img.required': 'الحقول المطلوبة: الرمز، الاسم.',
  'cat.img.updated': 'تم تحديث الفحص.',
  'cat.img.added': 'تمت إضافة الفحص إلى الفهرس.',
  'cat.img.deactivated': 'تم تعطيل الفحص.',
  'cat.img.confirmDeactivate': 'تعطيل الفحص «{name}» من الفهرس؟',
  'cat.img.deleteAria': 'حذف {name}',

  'cat.price.invalid': 'السعر الداخلي غير صالح.',
  'cat.code.taken': 'هذا الرمز مستعمل بالفعل.',
  'cat.permissionDenied': 'تم رفض الإذن (يتطلب دور طبيب أو مشرف).',
  'cat.saveError': 'فشل الحفظ.',
  'cat.deleteError': 'تعذّر الحذف.',
  'cat.other': 'أخرى',

  'cat.back': 'رجوع',
  'cat.mobile.medTitle': 'الفهرس',
  'cat.mobile.labTitle': 'التحاليل',
  'cat.mobile.imgTitle': 'الأشعة / التصوير',
  'cat.mobile.sub': '{n} مُدخَل',
  'cat.mobile.sub_plural': '{n} مُدخَلات',
  'cat.mobile.medManageNote':
    'تتم إدارة الفهرس (الإضافة / التعديل) من نسخة سطح المكتب بواسطة طبيب أو مشرف.',
  'cat.mobile.readonlyNote':
    'قائمة مرجعية للقراءة فقط. ستُفعَّل الإدارة (الإضافة، التعطيل) بمجرد أن يتيحها الخادم.',

  'cat.import.button': 'استيراد CSV',
  'cat.import.busy': 'جارٍ الاستيراد…',
  'cat.import.fileAria': 'استيراد ملف CSV ({kind})',
  'cat.import.title': 'ملف CSV بترميز UTF-8 — الأعمدة: {headers}',
  'cat.import.ok': 'تم الاستيراد — {added} مُضاف، {updated} مُحدَّث.',
  'cat.import.ok_plural': 'تم الاستيراد — {added} مُضاف، {updated} مُحدَّث.',
  'cat.import.partial':
    'استيراد جزئي — {added} مُضاف، {updated} مُحدَّث، {skipped} مُتجاهَل.',
  'cat.import.forbidden': 'ليست لديك صلاحية استيراد الفهرس.',
  'cat.import.rejected': 'تم رفض الملف.',
  'cat.import.error': 'فشل الاستيراد.',
};

const es: Dict = {
  'cat.tabsAria': 'Catálogos',
  'cat.tab.medicaments': 'Medicamentos',
  'cat.tab.analyses': 'Análisis',
  'cat.tab.radio': 'Radiología / Imagenología',

  'cat.med.title': 'Catálogo de medicamentos',
  'cat.med.sub': '{n} entrada comercializada en Marruecos',
  'cat.med.sub_plural': '{n} entradas comercializadas en Marruecos',
  'cat.add': 'Añadir',

  'cat.med.searchPlaceholder': 'Buscar por nombre comercial o DCI…',
  'cat.med.searchAria': 'Buscar un medicamento',
  'cat.med.allClasses': 'Todas las clases',
  'cat.med.classAria': 'Clase farmacológica',
  'cat.reset': 'Restablecer',

  'cat.med.col.dciName': 'DCI / Nombre comercial',
  'cat.med.col.form': 'Forma',
  'cat.med.col.dosage': 'Dosis',
  'cat.med.col.class': 'Clase',
  'cat.med.col.internalPrice': 'Precio interno',
  'cat.med.empty': 'Ningún medicamento coincide con la búsqueda.',
  'cat.med.emptyShort': 'Ningún medicamento coincide.',
  'cat.favoriteAria': 'Favorito',
  'cat.med.favoritePill': 'Favorito',
  'cat.med.favoriteRowAria': 'Medicamento favorito',

  'cat.med.drawer.edit': 'Editar medicamento',
  'cat.med.drawer.new': 'Nuevo medicamento',
  'cat.med.field.commercialName': 'Nombre comercial *',
  'cat.med.field.commercialName.ph': 'p. ej. Doliprane',
  'cat.med.field.dci': 'DCI (molécula) *',
  'cat.med.field.dci.ph': 'p. ej. Paracetamol',
  'cat.med.field.form': 'Forma *',
  'cat.med.field.form.ph': 'comprimido, jarabe, cápsula…',
  'cat.med.field.dosage': 'Dosis *',
  'cat.med.field.dosage.ph': '500mg, 10mg/ml…',
  'cat.med.field.class': 'Clase farmacológica',
  'cat.med.field.class.ph': 'p. ej. aine, ibp, analgésico, penicilinas…',
  'cat.med.field.class.hint':
    'Sirve para el control de alergias (las sustancias declaradas en el paciente se cotejan con esta etiqueta).',
  'cat.med.field.favorite': 'Marcar como favorito (aparece arriba en las sugerencias)',
  'cat.med.field.internalPrice': 'Precio de dispensación interna (MAD)',
  'cat.med.field.internalPrice.ph': 'p. ej. 45.00 — vacío = no facturable internamente',
  'cat.med.field.internalPrice.hint':
    'Si se indica, este precio se añade a la factura de consulta cuando el médico marca «dispensar internamente» en la prescripción.',
  'cat.med.submit.new': 'Añadir al catálogo',
  'cat.med.submit.edit': 'Guardar',

  'cat.med.loadError': 'No se pudo cargar el catálogo.',
  'cat.med.required': 'Campos obligatorios: Nombre comercial, DCI, Forma, Dosis.',
  'cat.med.updated': 'Medicamento actualizado.',
  'cat.med.added': 'Medicamento añadido al catálogo.',
  'cat.med.deactivated': 'Medicamento desactivado.',
  'cat.med.confirmDeactivate': '¿Desactivar «{name} {dosage}» del catálogo?',
  'cat.med.deleteAria': 'Eliminar {name}',

  'cat.lab.title': 'Catálogo de análisis',
  'cat.lab.sub': '{n} análisis',
  'cat.lab.sub_plural': '{n} análisis',

  'cat.lab.searchPlaceholder': 'Buscar por nombre o código…',
  'cat.lab.searchAria': 'Buscar un análisis',
  'cat.lab.allCategories': 'Todas las categorías',
  'cat.lab.categoryAria': 'Categoría de análisis',

  'cat.lab.col.code': 'Código',
  'cat.lab.col.name': 'Nombre',
  'cat.lab.col.category': 'Categoría',
  'cat.lab.col.internalPrice': 'Precio interno',
  'cat.lab.empty': 'Ningún análisis coincide con la búsqueda.',
  'cat.lab.emptyShort': 'Ningún análisis coincide.',

  'cat.lab.drawer.edit': 'Editar análisis',
  'cat.lab.drawer.new': 'Nuevo análisis',
  'cat.lab.field.code': 'Código *',
  'cat.lab.field.code.ph': 'p. ej. NFS, CRP, GLY-VEIN…',
  'cat.lab.field.code.hint': 'Identificador único usado en las prescripciones.',
  'cat.lab.field.name': 'Nombre *',
  'cat.lab.field.name.ph': 'p. ej. Hemograma completo',
  'cat.lab.field.category': 'Categoría',
  'cat.lab.field.category.ph': 'Hematología, Bacteriología, Bioquímica…',
  'cat.lab.field.internalPrice': 'Precio interno (MAD)',
  'cat.lab.field.internalPrice.ph': 'p. ej. 120 — dejar vacío = no facturable internamente',
  'cat.lab.field.internalPrice.hint':
    'V050 — Cuando el médico marca «Realizar internamente» y firma la consulta, esta línea se añade automáticamente a la factura borrador del paciente. Dejar vacío para no facturar automáticamente.',
  'cat.lab.submit.new': 'Añadir al catálogo',
  'cat.lab.submit.edit': 'Guardar',

  'cat.lab.loadError': 'No se pudieron cargar los análisis.',
  'cat.lab.required': 'Campos obligatorios: Código, Nombre.',
  'cat.lab.updated': 'Análisis actualizado.',
  'cat.lab.added': 'Análisis añadido al catálogo.',
  'cat.lab.deactivated': 'Análisis desactivado.',
  'cat.lab.confirmDeactivate': '¿Desactivar el análisis «{name}» del catálogo?',
  'cat.lab.deleteAria': 'Eliminar {name}',

  'cat.img.title': 'Catálogo de radiología / imagenología',
  'cat.img.sub': '{n} examen',
  'cat.img.sub_plural': '{n} exámenes',

  'cat.img.searchPlaceholder': 'Buscar por nombre o código…',
  'cat.img.searchAria': 'Buscar un examen de imagenología',
  'cat.img.allModalities': 'Todas las modalidades',
  'cat.img.modalityAria': 'Modalidad',

  'cat.img.col.code': 'Código',
  'cat.img.col.name': 'Nombre',
  'cat.img.col.modality': 'Modalidad',
  'cat.img.col.internalPrice': 'Precio interno',
  'cat.img.empty': 'Ningún examen coincide con la búsqueda.',
  'cat.img.emptyShort': 'Ningún examen coincide.',

  'cat.img.drawer.edit': 'Editar examen',
  'cat.img.drawer.new': 'Nuevo examen',
  'cat.img.field.code': 'Código *',
  'cat.img.field.code.ph': 'p. ej. RX-THX, ECHO-ABD…',
  'cat.img.field.code.hint': 'Identificador único usado en las prescripciones.',
  'cat.img.field.name': 'Nombre *',
  'cat.img.field.name.ph': 'p. ej. Radiografía de tórax frontal',
  'cat.img.field.modality': 'Modalidad',
  'cat.img.field.modality.other': '— Otra —',
  'cat.img.field.internalPrice': 'Precio interno (MAD)',
  'cat.img.field.internalPrice.ph': 'p. ej. 250 — dejar vacío = no facturable internamente',
  'cat.img.field.internalPrice.hint':
    'V050 — Cuando el médico marca «Realizar internamente» y firma la consulta, esta línea se añade automáticamente a la factura borrador del paciente. Dejar vacío para no facturar automáticamente.',
  'cat.img.submit.new': 'Añadir al catálogo',
  'cat.img.submit.edit': 'Guardar',

  'cat.img.loadError': 'No se pudieron cargar los exámenes de imagenología.',
  'cat.img.required': 'Campos obligatorios: Código, Nombre.',
  'cat.img.updated': 'Examen actualizado.',
  'cat.img.added': 'Examen añadido al catálogo.',
  'cat.img.deactivated': 'Examen desactivado.',
  'cat.img.confirmDeactivate': '¿Desactivar el examen «{name}» del catálogo?',
  'cat.img.deleteAria': 'Eliminar {name}',

  'cat.price.invalid': 'Precio interno no válido.',
  'cat.code.taken': 'Este código ya está en uso.',
  'cat.permissionDenied': 'Permiso denegado (se requiere rol MEDECIN o ADMIN).',
  'cat.saveError': 'Error al guardar.',
  'cat.deleteError': 'No se pudo eliminar.',
  'cat.other': 'Otros',

  'cat.back': 'Volver',
  'cat.mobile.medTitle': 'Catálogo',
  'cat.mobile.labTitle': 'Análisis',
  'cat.mobile.imgTitle': 'Radiología / Imagenología',
  'cat.mobile.sub': '{n} entrada',
  'cat.mobile.sub_plural': '{n} entradas',
  'cat.mobile.medManageNote':
    'La gestión del catálogo (añadir / editar) se realiza desde la versión de escritorio por un médico o un administrador.',
  'cat.mobile.readonlyNote':
    'Lista de referencia de solo lectura. La gestión (añadir, desactivar) se activará en cuanto el backend la exponga.',

  'cat.import.button': 'Importar CSV',
  'cat.import.busy': 'Importando…',
  'cat.import.fileAria': 'Importar un archivo CSV ({kind})',
  'cat.import.title': 'CSV UTF-8 — columnas: {headers}',
  'cat.import.ok': 'Importación correcta — {added} añadido, {updated} actualizado.',
  'cat.import.ok_plural': 'Importación correcta — {added} añadidos, {updated} actualizados.',
  'cat.import.partial':
    'Importación parcial — {added} añadido(s), {updated} actualizado(s), {skipped} omitido(s).',
  'cat.import.forbidden': 'No tiene permiso para importar el catálogo.',
  'cat.import.rejected': 'Archivo rechazado.',
  'cat.import.error': 'Error en la importación.',
};

export const catMessages: Record<Lang, Dict> = { fr, en, ar, es };
