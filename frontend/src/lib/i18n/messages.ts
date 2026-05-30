/**
 * Catalogue de traductions (#122). Clés plates, namespacées par préfixe
 * (`nav.*`, `settings.*`, `common.*`). On démarre par la navigation + l'écran
 * Paramètres (preuve de bout en bout) ; les autres écrans migreront leurs
 * chaînes ici progressivement.
 *
 * `fr` est la langue de référence (jeu de clés complet). Les autres langues
 * peuvent être partielles : une clé manquante retombe sur `fr` (voir provider).
 *
 * NB : traductions ar/es à faire relire par un locuteur natif avant prod — elles
 * sont fonctionnelles mais non certifiées linguistiquement.
 */
import type { Dict, Lang } from './index';

const fr: Dict = {
  'common.save': 'Enregistrer',
  'common.saving': 'Enregistrement…',
  'common.cancel': 'Annuler',
  'common.search': 'Rechercher',
  'common.loading': 'Chargement…',

  'nav.section.flux': 'Flux patient',
  'nav.section.config': 'Configuration',
  'nav.search.placeholder': 'Rechercher un menu…',
  'nav.search.results': 'Résultats',
  'nav.search.empty': 'Aucun menu correspondant.',
  'nav.dashboard': 'Dashboard',
  'nav.agenda': 'Agenda',
  'nav.patients': 'Patients',
  'nav.salle': "Salle d'attente",
  'nav.consult': 'Consultations',
  'nav.factu': 'Facturation',
  'nav.vaccinations': 'Vaccinations',
  'nav.grossesses': 'Grossesses',
  'nav.stock': 'Stock',
  'nav.sejours': 'Hospitalisation',
  'nav.messages': 'Messages',
  'nav.assistant': 'Assistant IA',
  'nav.catalogue': 'Catalogue',
  'nav.charges': 'Charges',
  'nav.personnel': 'Personnel',
  'nav.params': 'Paramètres',

  'settings.language.title': "Langue de l'application",
  'settings.language.hint':
    "Définit la langue de l'interface pour tous les utilisateurs. Réservé au super administrateur. L'arabe bascule l'affichage en mode droite-à-gauche.",
  'settings.language.saved': 'Langue mise à jour.',
  'settings.language.readonly':
    'Seul un super administrateur peut changer la langue de l’application.',
};

const en: Dict = {
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.search': 'Search',
  'common.loading': 'Loading…',

  'nav.section.flux': 'Patient flow',
  'nav.section.config': 'Configuration',
  'nav.search.placeholder': 'Search a menu…',
  'nav.search.results': 'Results',
  'nav.search.empty': 'No matching menu.',
  'nav.dashboard': 'Dashboard',
  'nav.agenda': 'Agenda',
  'nav.patients': 'Patients',
  'nav.salle': 'Waiting room',
  'nav.consult': 'Consultations',
  'nav.factu': 'Billing',
  'nav.vaccinations': 'Vaccinations',
  'nav.grossesses': 'Pregnancies',
  'nav.stock': 'Stock',
  'nav.sejours': 'Hospitalization',
  'nav.messages': 'Messages',
  'nav.assistant': 'AI Assistant',
  'nav.catalogue': 'Catalogue',
  'nav.charges': 'Expenses',
  'nav.personnel': 'Staff',
  'nav.params': 'Settings',

  'settings.language.title': 'Application language',
  'settings.language.hint':
    'Sets the interface language for all users. Super administrator only. Arabic switches the layout to right-to-left.',
  'settings.language.saved': 'Language updated.',
  'settings.language.readonly':
    'Only a super administrator can change the application language.',
};

const ar: Dict = {
  'common.save': 'حفظ',
  'common.saving': 'جارٍ الحفظ…',
  'common.cancel': 'إلغاء',
  'common.search': 'بحث',
  'common.loading': 'جارٍ التحميل…',

  'nav.section.flux': 'مسار المريض',
  'nav.section.config': 'الإعدادات',
  'nav.search.placeholder': 'ابحث عن قائمة…',
  'nav.search.results': 'النتائج',
  'nav.search.empty': 'لا توجد قائمة مطابقة.',
  'nav.dashboard': 'لوحة التحكم',
  'nav.agenda': 'الأجندة',
  'nav.patients': 'المرضى',
  'nav.salle': 'غرفة الانتظار',
  'nav.consult': 'الاستشارات',
  'nav.factu': 'الفوترة',
  'nav.vaccinations': 'التطعيمات',
  'nav.grossesses': 'الحمل',
  'nav.stock': 'المخزون',
  'nav.sejours': 'الاستشفاء',
  'nav.messages': 'الرسائل',
  'nav.assistant': 'المساعد الذكي',
  'nav.catalogue': 'الكتالوج',
  'nav.charges': 'المصاريف',
  'nav.personnel': 'الموظفون',
  'nav.params': 'الإعدادات',

  'settings.language.title': 'لغة التطبيق',
  'settings.language.hint':
    'تحدد لغة الواجهة لجميع المستخدمين. للمشرف العام فقط. العربية تحوّل العرض إلى اليمين-لليسار.',
  'settings.language.saved': 'تم تحديث اللغة.',
  'settings.language.readonly': 'المشرف العام وحده يمكنه تغيير لغة التطبيق.',
};

const es: Dict = {
  'common.save': 'Guardar',
  'common.saving': 'Guardando…',
  'common.cancel': 'Cancelar',
  'common.search': 'Buscar',
  'common.loading': 'Cargando…',

  'nav.section.flux': 'Flujo del paciente',
  'nav.section.config': 'Configuración',
  'nav.search.placeholder': 'Buscar un menú…',
  'nav.search.results': 'Resultados',
  'nav.search.empty': 'Ningún menú coincide.',
  'nav.dashboard': 'Panel',
  'nav.agenda': 'Agenda',
  'nav.patients': 'Pacientes',
  'nav.salle': 'Sala de espera',
  'nav.consult': 'Consultas',
  'nav.factu': 'Facturación',
  'nav.vaccinations': 'Vacunaciones',
  'nav.grossesses': 'Embarazos',
  'nav.stock': 'Inventario',
  'nav.sejours': 'Hospitalización',
  'nav.messages': 'Mensajes',
  'nav.assistant': 'Asistente IA',
  'nav.catalogue': 'Catálogo',
  'nav.charges': 'Gastos',
  'nav.personnel': 'Personal',
  'nav.params': 'Ajustes',

  'settings.language.title': 'Idioma de la aplicación',
  'settings.language.hint':
    'Define el idioma de la interfaz para todos los usuarios. Solo superadministrador. El árabe cambia la disposición a derecha-a-izquierda.',
  'settings.language.saved': 'Idioma actualizado.',
  'settings.language.readonly':
    'Solo un superadministrador puede cambiar el idioma de la aplicación.',
};

export const MESSAGES: Record<Lang, Dict> = { fr, en, ar, es };
