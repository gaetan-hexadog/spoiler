# Spoiler Scrobbler pour Kodi

Service Kodi qui enregistre automatiquement dans **Spoiler** (Supabase) les
films et épisodes que tu termines.

## Comment ça marche

- Le service surveille la lecture en tâche de fond (toutes les 5 s).
- À l'arrêt ou à la fin d'une vidéo, si la position atteinte dépasse le
  **seuil configuré (85 % par défaut)**, l'élément est marqué comme vu —
  tu peux zapper le générique de fin sans rien perdre.
- Les vidéos de moins de 5 minutes (bandes-annonces…) sont ignorées, et un
  même épisode n'est jamais loggé deux fois dans la session.
- Identification : IDs TMDB fournis par les scrapers Kodi en priorité, sinon
  conversion TVDB/IMDB → TMDB, sinon recherche par titre (nécessite le jeton
  TMDB dans les réglages).
- Épisode loggé → la série est automatiquement suivie dans Spoiler ; film
  loggé → ajouté en « vu » (le statut watchlist est écrasé, la note est
  conservée).

## Association par code (zéro saisie à la télécommande)

Au premier lancement, l'extension affiche un **code à 6 caractères**.
Dans l'app Spoiler : **Profil → Réglages → Associer un appareil Kodi**,
saisis le code — c'est tout. Kodi récupère sa propre session Supabase
(jeton à usage unique généré côté serveur) et même ton jeton TMDB envoyé
par l'app. L'URL du projet et la clé publishable sont pré-embarquées dans
le zip. Le mot de passe ne quitte jamais ton téléphone ; la RLS s'applique
comme dans l'app. (Fallback possible : email/mot de passe dans les
réglages « Avancé ».)

## Prérequis côté Supabase (une seule fois)

1. Appliquer la migration `supabase/migrations/20260704093915_device_links.sql`
   (SQL Editor, ou `supabase db push`).
2. Déployer la fonction d'association :

```bash
supabase login
supabase link --project-ref zmilkvfzjwhzwstebigj
supabase functions deploy pair-device
```

## Installation

1. Copier `service.spoiler-1.1.0.zip` sur l'appareil Kodi.
2. Kodi → **Paramètres → Extensions → Installer depuis un fichier zip**
   (autoriser les « sources inconnues » si demandé).
3. Le code d'association s'affiche → le saisir dans l'app (10 min max,
   redémarrer Kodi pour regénérer un code).
4. Lancer une vidéo, la terminer (ou dépasser 85 %) → notification
   « 📺 … vu ✓ » et l'élément apparaît dans l'app.

Compatible Kodi 20 (Nexus) et plus récent.

## Re-packager après modification

```bash
cd kodi && zip -r service.spoiler-1.1.0.zip service.spoiler
```
