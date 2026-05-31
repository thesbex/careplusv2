/**
 * Traductions (#122) — écran « Assistant IA » (aide à la décision clinique).
 *
 * Module séparé fusionné dans `MESSAGES` (voir lib/i18n/messages.ts). `fr` est la
 * langue de référence : chaque clé `fr` DOIT exister en en/ar/es (test de parité CI).
 * ar/es fonctionnels, à faire relire par un locuteur natif avant prod.
 *
 * Réutilise `nav.assistant` du catalogue de base — non redéfini ici. Les nouvelles
 * clés sont préfixées `ai.`. Les noms de provider (Gemini, OpenAI…) restent des
 * marques non traduites (cf. providerLabel dans AssistantPage).
 */
import type { Dict, Lang } from '@/lib/i18n/index';

const fr: Dict = {
  // ── En-tête ──────────────────────────────────────────────────────────────
  'ai.title': 'Assistant IA',
  'ai.subDefault': 'Aide à la décision clinique',

  // ── Rail des conversations ──────────────────────────────────────────────────
  'ai.conversationsAria': 'Mes conversations',
  'ai.newConversation': 'Nouvelle conversation',
  'ai.new': 'Nouvelle',
  'ai.conversationsList': 'Conversations ({n})',
  'ai.emptyRail': "Aucune conversation pour l'instant.",
  'ai.empty': 'Aucune conversation.',
  'ai.linkedToRecord': 'Conversation liée à un dossier',
  'ai.deleteConversation': 'Supprimer la conversation',
  'ai.delete': 'Supprimer',

  // ── Bannière non configuré ──────────────────────────────────────────────────
  'ai.notConfigured': 'Assistant non configuré.',
  'ai.notConfiguredHint':
    "Renseignez une clé API (GEMINI_API_KEY) côté serveur pour activer l'assistant.",
  'ai.notConfiguredShort': 'Clé API manquante côté serveur.',

  // ── Contexte patient ────────────────────────────────────────────────────────
  'ai.thisPatient': 'ce patient',
  'ai.contextNote':
    'Contexte joint : un résumé clinique du dossier de {name} sera transmis au modèle avec votre première question.',
  'ai.contextNoteShort': 'Contexte joint : dossier de {name}.',
  'ai.contextClear': 'Retirer',

  // ── Fil / accueil ───────────────────────────────────────────────────────────
  'ai.welcomeTitle': 'Comment puis-je vous aider ?',
  'ai.welcomeText':
    "Posologies, interactions, conduite à tenir, synthèse de dossier… L'assistant est une aide à la décision ; le jugement clinique final vous revient.",
  'ai.roleUser': 'Vous',
  'ai.roleAssistant': 'Assistant',
  'ai.typing': "L'assistant rédige une réponse",

  // ── Erreurs ──────────────────────────────────────────────────────────────────
  'ai.error': "L'assistant n'a pas pu répondre. Réessayez dans un instant.",
  'ai.errorShort': "L'assistant n'a pas pu répondre.",
  'ai.errLoadConfig': "Impossible de lire la configuration de l'assistant.",
  'ai.errLoadList': 'Chargement impossible.',
  'ai.errLoadConversation': 'Conversation introuvable.',

  // ── Composer ────────────────────────────────────────────────────────────────
  'ai.placeholder': 'Posez votre question…',
  'ai.placeholderShort': 'Votre question…',
  'ai.placeholderUnavailable': 'Assistant indisponible',
  'ai.placeholderUnavailableShort': 'Indisponible',
  'ai.send': 'Envoyer',
};

const en: Dict = {
  'ai.title': 'AI Assistant',
  'ai.subDefault': 'Clinical decision support',

  'ai.conversationsAria': 'My conversations',
  'ai.newConversation': 'New conversation',
  'ai.new': 'New',
  'ai.conversationsList': 'Conversations ({n})',
  'ai.emptyRail': 'No conversation yet.',
  'ai.empty': 'No conversation.',
  'ai.linkedToRecord': 'Conversation linked to a record',
  'ai.deleteConversation': 'Delete conversation',
  'ai.delete': 'Delete',

  'ai.notConfigured': 'Assistant not configured.',
  'ai.notConfiguredHint':
    'Set an API key (GEMINI_API_KEY) on the server to enable the assistant.',
  'ai.notConfiguredShort': 'API key missing on the server.',

  'ai.thisPatient': 'this patient',
  'ai.contextNote':
    "Context attached: a clinical summary of {name}'s record will be sent to the model with your first question.",
  'ai.contextNoteShort': "Context attached: {name}'s record.",
  'ai.contextClear': 'Remove',

  'ai.welcomeTitle': 'How can I help you?',
  'ai.welcomeText':
    'Dosages, interactions, management, record summary… The assistant is decision support; the final clinical judgment is yours.',
  'ai.roleUser': 'You',
  'ai.roleAssistant': 'Assistant',
  'ai.typing': 'The assistant is writing a reply',

  'ai.error': 'The assistant could not respond. Try again in a moment.',
  'ai.errorShort': 'The assistant could not respond.',
  'ai.errLoadConfig': 'Could not read the assistant configuration.',
  'ai.errLoadList': 'Loading failed.',
  'ai.errLoadConversation': 'Conversation not found.',

  'ai.placeholder': 'Ask your question…',
  'ai.placeholderShort': 'Your question…',
  'ai.placeholderUnavailable': 'Assistant unavailable',
  'ai.placeholderUnavailableShort': 'Unavailable',
  'ai.send': 'Send',
};

const ar: Dict = {
  'ai.title': 'المساعد الذكي',
  'ai.subDefault': 'دعم القرار السريري',

  'ai.conversationsAria': 'محادثاتي',
  'ai.newConversation': 'محادثة جديدة',
  'ai.new': 'جديدة',
  'ai.conversationsList': 'المحادثات ({n})',
  'ai.emptyRail': 'لا توجد محادثات بعد.',
  'ai.empty': 'لا توجد محادثات.',
  'ai.linkedToRecord': 'محادثة مرتبطة بملف',
  'ai.deleteConversation': 'حذف المحادثة',
  'ai.delete': 'حذف',

  'ai.notConfigured': 'المساعد غير مُعدّ.',
  'ai.notConfiguredHint':
    'أدخل مفتاح API (GEMINI_API_KEY) على الخادم لتفعيل المساعد.',
  'ai.notConfiguredShort': 'مفتاح API مفقود على الخادم.',

  'ai.thisPatient': 'هذا المريض',
  'ai.contextNote':
    'السياق مُرفق: سيُرسل ملخص سريري لملف {name} إلى النموذج مع سؤالك الأول.',
  'ai.contextNoteShort': 'السياق مُرفق: ملف {name}.',
  'ai.contextClear': 'إزالة',

  'ai.welcomeTitle': 'كيف يمكنني مساعدتك؟',
  'ai.welcomeText':
    'الجرعات، التفاعلات، التدبير، ملخص الملف… المساعد هو دعم للقرار؛ الحكم السريري النهائي يعود إليك.',
  'ai.roleUser': 'أنت',
  'ai.roleAssistant': 'المساعد',
  'ai.typing': 'المساعد يكتب ردًا',

  'ai.error': 'تعذّر على المساعد الرد. أعد المحاولة بعد لحظة.',
  'ai.errorShort': 'تعذّر على المساعد الرد.',
  'ai.errLoadConfig': 'تعذّر قراءة إعدادات المساعد.',
  'ai.errLoadList': 'تعذّر التحميل.',
  'ai.errLoadConversation': 'المحادثة غير موجودة.',

  'ai.placeholder': 'اطرح سؤالك…',
  'ai.placeholderShort': 'سؤالك…',
  'ai.placeholderUnavailable': 'المساعد غير متاح',
  'ai.placeholderUnavailableShort': 'غير متاح',
  'ai.send': 'إرسال',
};

const es: Dict = {
  'ai.title': 'Asistente IA',
  'ai.subDefault': 'Apoyo a la decisión clínica',

  'ai.conversationsAria': 'Mis conversaciones',
  'ai.newConversation': 'Nueva conversación',
  'ai.new': 'Nueva',
  'ai.conversationsList': 'Conversaciones ({n})',
  'ai.emptyRail': 'Aún no hay conversaciones.',
  'ai.empty': 'Sin conversaciones.',
  'ai.linkedToRecord': 'Conversación vinculada a un expediente',
  'ai.deleteConversation': 'Eliminar la conversación',
  'ai.delete': 'Eliminar',

  'ai.notConfigured': 'Asistente no configurado.',
  'ai.notConfiguredHint':
    'Introduce una clave API (GEMINI_API_KEY) en el servidor para activar el asistente.',
  'ai.notConfiguredShort': 'Falta la clave API en el servidor.',

  'ai.thisPatient': 'este paciente',
  'ai.contextNote':
    'Contexto adjunto: se enviará al modelo un resumen clínico del expediente de {name} con tu primera pregunta.',
  'ai.contextNoteShort': 'Contexto adjunto: expediente de {name}.',
  'ai.contextClear': 'Quitar',

  'ai.welcomeTitle': '¿En qué puedo ayudarte?',
  'ai.welcomeText':
    'Posologías, interacciones, conducta a seguir, síntesis del expediente… El asistente es un apoyo a la decisión; el juicio clínico final es tuyo.',
  'ai.roleUser': 'Tú',
  'ai.roleAssistant': 'Asistente',
  'ai.typing': 'El asistente está redactando una respuesta',

  'ai.error': 'El asistente no pudo responder. Inténtalo de nuevo en un momento.',
  'ai.errorShort': 'El asistente no pudo responder.',
  'ai.errLoadConfig': 'No se pudo leer la configuración del asistente.',
  'ai.errLoadList': 'Error al cargar.',
  'ai.errLoadConversation': 'Conversación no encontrada.',

  'ai.placeholder': 'Escribe tu pregunta…',
  'ai.placeholderShort': 'Tu pregunta…',
  'ai.placeholderUnavailable': 'Asistente no disponible',
  'ai.placeholderUnavailableShort': 'No disponible',
  'ai.send': 'Enviar',
};

export const aiMessages: Record<Lang, Dict> = { fr, en, ar, es };
