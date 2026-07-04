# Client Supabase (REST pur, sans dépendance) + résolution TMDB + pairing.
import json
import time
import urllib.error
import urllib.parse
import urllib.request


def _http(method, url, body=None, headers=None):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read().decode('utf-8')
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read().decode('utf-8')
        try:
            payload = json.loads(raw) if raw else None
        except ValueError:
            payload = {'message': raw}
        return error.code, payload


class PopcornLogError(Exception):
    pass


# --- Association par code (device pairing) -----------------------------------

def rpc(url, anon_key, name, args=None):
    """Appel RPC Postgres en anonyme (create/poll du code d'association)."""
    status, payload = _http(
        'POST',
        '{}/rest/v1/rpc/{}'.format(url.rstrip('/'), name),
        args or {},
        {
            'apikey': anon_key,
            'Authorization': 'Bearer {}'.format(anon_key),
            'Content-Type': 'application/json',
        },
    )
    if status not in (200, 201, 204):
        raise PopcornLogError((payload or {}).get('message') or 'erreur {}'.format(status))
    return payload


def verify_magiclink(url, anon_key, token_hash):
    """Échange le jeton à usage unique contre une session complète."""
    status, payload = _http(
        'POST',
        '{}/auth/v1/verify'.format(url.rstrip('/')),
        {'type': 'magiclink', 'token_hash': token_hash},
        {'apikey': anon_key, 'Content-Type': 'application/json'},
    )
    if status != 200 or not payload or 'access_token' not in payload:
        raise PopcornLogError(
            (payload or {}).get('error_description')
            or (payload or {}).get('msg')
            or 'échange du jeton impossible'
        )
    return payload


# --- Client authentifié -------------------------------------------------------

class PopcornLogClient:
    """Session Supabase entretenue par refresh token (associé par code) —
    fallback email/mot de passe si renseignés dans les réglages."""

    def __init__(self, url, anon_key, email=None, password=None,
                 refresh_token=None, on_tokens=None):
        self.url = url.rstrip('/')
        self.anon_key = anon_key
        self.email = email
        self.password = password
        self.refresh_token = refresh_token
        self.on_tokens = on_tokens  # persiste le refresh token (rotation)
        self.access_token = None
        self.expiry = 0

    def _auth_request(self, grant, body):
        status, payload = _http(
            'POST',
            '{}/auth/v1/token?grant_type={}'.format(self.url, grant),
            body,
            {'apikey': self.anon_key, 'Content-Type': 'application/json'},
        )
        if status != 200 or not payload or 'access_token' not in payload:
            message = (payload or {}).get('error_description') or (payload or {}).get(
                'msg'
            ) or 'authentification impossible'
            raise PopcornLogError(message)
        self.access_token = payload['access_token']
        self.refresh_token = payload.get('refresh_token') or self.refresh_token
        self.expiry = time.time() + int(payload.get('expires_in', 3600))
        if self.on_tokens and self.refresh_token:
            self.on_tokens(self.refresh_token)

    def _ensure_token(self):
        if self.access_token and time.time() < self.expiry - 60:
            return
        if self.refresh_token:
            try:
                self._auth_request(
                    'refresh_token', {'refresh_token': self.refresh_token}
                )
                return
            except PopcornLogError:
                self.refresh_token = None
                if self.on_tokens:
                    self.on_tokens('')
        if self.email and self.password:
            self._auth_request(
                'password', {'email': self.email, 'password': self.password}
            )
            return
        raise PopcornLogError('appareil non associé — relance Kodi pour obtenir un code')

    def adopt_session(self, session):
        """Injecte la session obtenue lors de l'association."""
        self.access_token = session.get('access_token')
        self.refresh_token = session.get('refresh_token')
        self.expiry = time.time() + int(session.get('expires_in', 3600))
        if self.on_tokens and self.refresh_token:
            self.on_tokens(self.refresh_token)

    def _rest(self, path, body, prefer):
        self._ensure_token()
        status, payload = _http(
            'POST',
            self.url + path,
            body,
            {
                'apikey': self.anon_key,
                'Authorization': 'Bearer {}'.format(self.access_token),
                'Content-Type': 'application/json',
                'Prefer': prefer,
            },
        )
        if status not in (200, 201, 204):
            raise PopcornLogError((payload or {}).get('message') or 'erreur {}'.format(status))

    def log_movie(self, tmdb_id, title, poster_path=None):
        self._rest(
            '/rest/v1/user_movies?on_conflict=user_id,tmdb_id',
            {
                'tmdb_id': tmdb_id,
                'title': title,
                'poster_path': poster_path,
                'status': 'watched',
                'watched_at': _iso_now(),
            },
            'resolution=merge-duplicates',
        )

    def log_episode(self, show_tmdb_id, show_name, season, episode, poster_path=None):
        # La série doit exister dans la bibliothèque (ignorée si déjà suivie).
        self._rest(
            '/rest/v1/tracked_shows?on_conflict=user_id,tmdb_id',
            {
                'tmdb_id': show_tmdb_id,
                'name': show_name,
                'poster_path': poster_path,
                'status': 'watching',
            },
            'resolution=ignore-duplicates',
        )
        self._rest(
            '/rest/v1/watched_episodes'
            '?on_conflict=user_id,tmdb_show_id,season_number,episode_number',
            {
                'tmdb_show_id': show_tmdb_id,
                'season_number': season,
                'episode_number': episode,
                'watched_at': _iso_now(),
            },
            'resolution=ignore-duplicates',
        )


def _iso_now():
    return time.strftime('%Y-%m-%dT%H:%M:%S+00:00', time.gmtime())


class TmdbResolver:
    """Résolution de secours quand Kodi ne fournit pas d'ID TMDB."""

    def __init__(self, token):
        self.token = (token or '').strip()

    @property
    def available(self):
        return bool(self.token)

    def _get(self, path, params=None):
        params = dict(params or {})
        headers = {'Accept': 'application/json'}
        if '.' in self.token:
            headers['Authorization'] = 'Bearer {}'.format(self.token)
        else:
            params['api_key'] = self.token
        url = 'https://api.themoviedb.org/3{}?{}'.format(
            path, urllib.parse.urlencode(params)
        )
        status, payload = _http('GET', url, None, headers)
        return payload if status == 200 else None

    def find_by_external(self, source, external_id, kind):
        """kind: 'tv' ou 'movie'. source: 'tvdb_id' ou 'imdb_id'."""
        payload = self._get(
            '/find/{}'.format(external_id), {'external_source': source}
        )
        if not payload:
            return None
        results = payload.get('tv_results' if kind == 'tv' else 'movie_results') or []
        return results[0] if results else None

    def search_tv(self, name):
        payload = self._get('/search/tv', {'query': name})
        results = (payload or {}).get('results') or []
        return results[0] if results else None

    def search_movie(self, title, year=None):
        params = {'query': title}
        if year:
            params['primary_release_year'] = year
        payload = self._get('/search/movie', params)
        results = (payload or {}).get('results') or []
        if not results and year:
            return self.search_movie(title)
        return results[0] if results else None
