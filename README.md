# 🍿 Spoiler

Remplaçant de TV Time : suivi de séries épisode par épisode, watchlist films,
calendrier des sorties. Construit avec **Expo / React Native**, **Supabase**
(auth + base de données), **TMDB** (métadonnées séries/films) et
**[Uniwind](https://uniwind.dev)** (Tailwind CSS v4 pour React Native).

## Fonctionnalités

- **Mes séries** — progression par série, « à voir ensuite », bouton ✓ pour
  marquer l'épisode suivant comme vu, statuts (en cours / à commencer /
  terminée / arrêtée)
- **Détail série** — saisons dépliables, marquage épisode par épisode,
  « tout vu » par saison
- **Calendrier** — prochains épisodes annoncés pour tes séries suivies
- **Découvrir** — tendances de la semaine + recherche (séries et films), en français
- **Films** — watchlist et films vus
- **Profil** — statistiques + **import de ton historique TV Time (CSV)**

## Mise en route

### 1. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com/dashboard).
2. Applique le schéma : ouvre **SQL Editor** dans le dashboard et colle le
   contenu de [`supabase/migrations/20260702185724_init.sql`](supabase/migrations/20260702185724_init.sql).
   (Ou en CLI : `supabase link --project-ref <ref>` puis `supabase db push`.)
3. Si tu veux te connecter immédiatement sans email de confirmation :
   **Authentication → Sign In / Up → Email → désactive « Confirm email »**.
4. Récupère l'URL du projet et la clé publishable dans
   **Project Settings → API Keys**.

> Note : si les requêtes renvoient « permission denied », vérifie que le
> schéma `public` est bien exposé dans **Settings → Data API** (c'est le cas
> par défaut).

### 2. TMDB

1. Crée un compte sur [themoviedb.org](https://www.themoviedb.org/signup).
2. Dans [Paramètres → API](https://www.themoviedb.org/settings/api), demande
   une clé (usage personnel/non commercial : gratuit).
3. Copie le **jeton d'accès en lecture à l'API** (long JWT) — la clé courte
   v3 fonctionne aussi.

### 3. Lancer l'app

```bash
cp .env.example .env   # puis remplis les 3 valeurs
npm install --legacy-peer-deps
npm start              # scanne le QR code avec Expo Go sur Android
```

Pour un APK installable :

```bash
npm install -g eas-cli
eas build --platform android --profile preview
```

## Import TV Time

Avant la fermeture de TV Time, demande l'export de tes données
(dans l'app : paramètres du compte, ou demande RGPD à support@tvtime.com).
Dans Spoiler : **Profil → Importer mon historique TV Time**, puis sélectionne
le CSV des épisodes vus (`seen_episode.csv`). Chaque série est retrouvée sur
TMDB et ton historique est recréé. Les séries non reconnues sont listées à la
fin pour un ajout manuel.

## Architecture

```
app/                    # routes expo-router
  (auth)/               # login / signup
  (tabs)/               # 5 onglets : séries, calendrier, découvrir, films, profil
  show/[id].tsx         # détail série + saisons/épisodes
  movie/[id].tsx        # détail film
  import.tsx            # import CSV TV Time
global.css              # thème Tailwind v4 (@theme : palette sombre + accent jaune)
metro.config.js         # plugin Uniwind (withUniwindConfig)
lib/
  supabase.ts           # client Supabase (session persistée AsyncStorage)
  tmdb.ts               # client TMDB (fr-FR)
  db.ts                 # accès aux tables (RLS par utilisateur)
  progress.ts           # calcul progression / prochain épisode
  tvtime.ts             # parseur CSV TV Time
supabase/migrations/    # schéma SQL (profiles, tracked_shows,
                        # watched_episodes, user_movies) + RLS
```

⚠️ La clé TMDB est embarquée dans l'app (`EXPO_PUBLIC_*`) : acceptable pour un
usage personnel, mais pour une app publiée passe par une Edge Function Supabase
qui proxifie TMDB.

Données fournies par [TMDB](https://www.themoviedb.org). Cette application
n'est ni approuvée ni certifiée par TMDB.
