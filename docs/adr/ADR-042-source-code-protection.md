# ADR-040 — Protection du code source après déploiement chez le client

- **Statut** : Accepté (mise en œuvre par étapes)
- **Date** : 2026-05-30
- **Contexte backlog** : « Je souhaite sécuriser le code source de l'application
  après déploiement chez le client (via chiffrement ou obfuscation) » (Feature, Minor).

## Contexte

careplus est déployé **on-premise** chez chaque cabinet (un jar Spring Boot qui
sert le bundle React depuis `src/main/resources/static/`, ADR-020). Le binaire
vit donc sur une machine que le client contrôle physiquement. Le commanditaire
veut réduire le risque qu'un tiers (client, concurrent, prestataire informatique
local) **lise, copie ou réutilise** le code source livré.

Réalité à poser franchement : **aucune protection logicielle n'est inviolable**
quand l'attaquant possède la machine et le binaire. Le code Java se décompile,
le JS se dé-obfusque, une clé de déchiffrement présente sur la machine se
retrouve. L'objectif réaliste est donc de **relever significativement la barre**
(décourager la copie opportuniste, empêcher la lecture triviale) et de
**compléter par du contractuel** (clause de propriété intellectuelle / non-
réutilisation dans le contrat d'abonnement), pas d'atteindre l'inviolabilité.

## Options envisagées

1. **JAR scellé + bundle JS obfusqué (retenu).** On livre uniquement des
   artefacts compilés : pas de `.java`, JS minifié + obfusqué, secrets hors-jar.
   Réaliste, sans coût d'exécution, n'altère pas le fonctionnement.
2. **Chiffrement complet de l'artefact au repos.** Le jar est chiffré et
   déchiffré au démarrage par une clé. Problème : la clé doit vivre sur la
   machine client (ou être saisie au boot, incompatible avec un démarrage
   automatique de service). Protection surtout symbolique, complexité et
   fragilité opérationnelle élevées (un boot raté = cabinet à l'arrêt).
3. **Ne rien faire / contractuel seul.** Insuffisant au regard de la demande.

## Décision

**Option 1**, mise en œuvre par étapes du moins au plus intrusif :

### Étape A — Hygiène de livraison (immédiat, zéro risque)
- Livrer **le seul jar** (`mvn package`), jamais l'arborescence source ni le `.git`.
- `tsc` + Vite produisent déjà un bundle **minifié sans source-maps** en prod :
  vérifier que `build.sourcemap = false` (défaut Vite en prod) et qu'aucun
  `.map` n'est inclus dans `static/`.
- **Secrets hors binaire** : JWT secret, mot de passe DB, clés OVH/Gemini via
  variables d'environnement / fichier de conf externe au jar (déjà le cas pour
  le JWT — cf. `JwtSecretValidator`). Aucun secret en dur dans le code livré.
- Désactiver Swagger / `/v3/api-docs` en profil client (ils exposent la
  cartographie de l'API). À gater sur le profil de déploiement on-premise.

### Étape B — Obfuscation du bundle front (faible risque)
- Ajouter une passe d'**obfuscation JavaScript** sur le bundle de production
  (renommage d'identifiants, suppression des noms parlants). Outil pressenti :
  `javascript-obfuscator` via un plugin Vite, **activé uniquement** pour un
  build « client on-premise » (pas en dev, pas pour le déploiement cloud où le
  coût de debug l'emporte).
- **Pré-requis ADR-015/016/017** : toute nouvelle dépendance front doit être
  défendue dans DECISIONS.md (alternatives + justification). À faire au moment
  de l'implémentation effective, pas dans cet ADR de cadrage.
- Garder la minification Terser agressive (déjà active) ; l'obfuscation vient
  par-dessus.

### Étape C — Durcissement du jar Java (optionnel, à évaluer)
- Le bytecode Java reste décompilable. Si l'enjeu le justifie, évaluer un
  obfuscateur bytecode (ProGuard) sur les packages métier `ma.careplus.*`.
  **Coût réel** : casse la réflexion (Spring, Hibernate, Jackson, MapStruct)
  si mal configuré → nécessite des règles `-keep` étendues et un cycle de tests
  complet. À ne tenter qu'avec `mvn verify` vert et un effort de validation
  dédié. Non prioritaire ; documenté ici pour décision ultérieure.

### Étape D — Contractuel (hors code, indispensable)
- Clause de **propriété intellectuelle et de non-décompilation / non-
  réutilisation** dans le contrat d'abonnement. C'est la protection qui a le
  plus de valeur juridique réelle ; le technique ne fait que dissuader.

## Conséquences

- **Positif** : lecture triviale du code empêchée (pas de sources, JS obfusqué) ;
  secrets jamais livrés dans le binaire ; surface d'information réduite (Swagger
  off). Barre nettement relevée pour une copie opportuniste.
- **Négatif / limites** : ne résiste pas à un attaquant déterminé disposant de
  la machine ; l'obfuscation JS complique le diagnostic d'incident en prod
  (prévoir un build non-obfusqué interne pour le support) ; ProGuard (étape C)
  introduit un risque de régression réel et reste donc optionnel.
- **Suivi** : étape A applicable dès le prochain packaging client ; étapes B/C
  à planifier avec leur propre validation (et, pour B, l'ADR de dépendance).

## Périmètre de cette itération

Cet ADR **cadre et acte la stratégie**. L'étape A (hygiène de livraison) est de
la configuration de packaging sans risque ; les étapes B et C touchent la
chaîne de build et des dépendances et seront implémentées dans une itération
dédiée, chacune avec build vert et, pour B, l'ADR de dépendance requis par les
règles frontend du projet.
