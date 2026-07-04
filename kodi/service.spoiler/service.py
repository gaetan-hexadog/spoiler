# Spoiler Scrobbler — service Kodi.
# Surveille la lecture ; quand elle dépasse le seuil configuré, enregistre le
# film ou l'épisode comme vu dans Supabase (le générique de fin est ignoré).
# Première utilisation : affiche un code d'association à saisir dans l'app
# (Profil → Réglages → Associer un appareil Kodi) — aucune saisie sur la TV.
import json
import os
import sys

import xbmc
import xbmcaddon
import xbmcgui

ADDON = xbmcaddon.Addon()
sys.path.insert(
    0, os.path.join(ADDON.getAddonInfo('path'), 'resources', 'lib')
)
import config  # noqa: E402
from spoiler import (  # noqa: E402
    SpoilerClient,
    SpoilerError,
    TmdbResolver,
    rpc,
    verify_magiclink,
)

POLL_SECONDS = 5
PAIRING_POLL_SECONDS = 3
PAIRING_TIMEOUT_SECONDS = 600


def log(message, level=xbmc.LOGINFO):
    xbmc.log('[service.spoiler] {}'.format(message), level)


def setting(key):
    return xbmcaddon.Addon().getSetting(key)


def set_setting(key, value):
    xbmcaddon.Addon().setSetting(key, value)


def connection():
    """URL + clé anon : pré-embarquées, surchargées par les réglages."""
    url = setting('supabase_url') or config.SUPABASE_URL
    key = setting('supabase_key') or config.SUPABASE_ANON_KEY
    return url, key


def notify(message, error=False):
    if setting('notify') != 'true' and not error:
        return
    xbmcgui.Dialog().notification(
        'Spoiler',
        message,
        xbmcgui.NOTIFICATION_ERROR if error else xbmcgui.NOTIFICATION_INFO,
        4000,
    )


def jsonrpc(method, params):
    response = json.loads(
        xbmc.executeJSONRPC(
            json.dumps(
                {'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}
            )
        )
    )
    return response.get('result') or {}


class Service:
    def __init__(self):
        self.player = xbmc.Player()
        self.snapshot = None
        self.logged = set()
        self.client = None
        self.client_config = None

    # --- Association par code -------------------------------------------------

    def is_configured(self):
        return bool(setting('refresh_token') or (setting('email') and setting('password')))

    def pair(self, monitor):
        """Affiche un code OTP et attend sa validation dans l'app Spoiler."""
        url, key = connection()
        if not url or not key:
            notify('Configuration Supabase manquante', error=True)
            return False
        try:
            code = rpc(url, key, 'create_device_link')
        except SpoilerError as error:
            notify('Association impossible : {}'.format(error), error=True)
            return False

        dialog = xbmcgui.DialogProgress()
        dialog.create(
            'Spoiler — Associer cet appareil',
            'Code : [B]{}[/B]\n'
            'Dans l’app Spoiler : Profil → Réglages → Associer un appareil Kodi.\n'
            'Le code expire dans 10 minutes.'.format(code),
        )
        elapsed = 0
        try:
            while elapsed < PAIRING_TIMEOUT_SECONDS:
                if dialog.iscanceled() or monitor.waitForAbort(PAIRING_POLL_SECONDS):
                    return False
                elapsed += PAIRING_POLL_SECONDS
                dialog.update(int(elapsed * 100 / PAIRING_TIMEOUT_SECONDS))
                try:
                    result = rpc(url, key, 'poll_device_link', {'p_code': code})
                except SpoilerError:
                    continue
                if not result:
                    continue
                session = verify_magiclink(url, key, result.get('token_hash'))
                set_setting('refresh_token', session.get('refresh_token', ''))
                payload = result.get('payload') or {}
                if payload.get('tmdb_token') and not setting('tmdb_token'):
                    set_setting('tmdb_token', payload['tmdb_token'])
                notify('Appareil associé ✓')
                log('association réussie')
                return True
        except SpoilerError as error:
            notify('Association échouée : {}'.format(error), error=True)
            return False
        finally:
            dialog.close()
        notify('Code expiré — relance Kodi pour réessayer', error=True)
        return False

    # --- Configuration ---------------------------------------------------------

    def get_client(self):
        url, key = connection()
        current = (url, key, setting('email'), setting('password'), setting('refresh_token'))
        if not url or not key:
            return None
        if self.client is None or self.client_config != current:
            self.client = SpoilerClient(
                url,
                key,
                email=setting('email') or None,
                password=setting('password') or None,
                refresh_token=setting('refresh_token') or None,
                on_tokens=lambda token: set_setting('refresh_token', token),
            )
            self.client_config = current
        return self.client

    # --- Capture pendant la lecture ---------------------------------------------

    def poll(self):
        if not self.player.isPlayingVideo():
            self.flush()
            return
        try:
            total = self.player.getTotalTime()
            position = self.player.getTime()
        except RuntimeError:
            return
        min_duration = int(setting('min_duration') or '5') * 60
        if total < min_duration:
            return
        item = self.capture_item()
        if item is None:
            return
        # Nouvelle vidéo pendant qu'une snapshot existe → traiter l'ancienne.
        if self.snapshot and self.snapshot['key'] != item['key']:
            self.flush()
        item['position'] = position
        item['total'] = total
        self.snapshot = item

    def capture_item(self):
        try:
            tag = self.player.getVideoInfoTag()
        except RuntimeError:
            return None
        mediatype = tag.getMediaType()
        if mediatype == 'episode':
            season = tag.getSeason()
            episode = tag.getEpisode()
            if season < 0 or episode <= 0:
                return None
            return {
                'kind': 'episode',
                'show': tag.getTVShowTitle(),
                'season': season,
                'episode': episode,
                'dbid': tag.getDbId(),
                'key': 'e:{}:{}:{}'.format(tag.getTVShowTitle(), season, episode),
            }
        if mediatype == 'movie':
            return {
                'kind': 'movie',
                'title': tag.getTitle(),
                'year': tag.getYear(),
                'uniqueid': tag.getUniqueID('tmdb'),
                'dbid': tag.getDbId(),
                'key': 'm:{}:{}'.format(tag.getTitle(), tag.getYear()),
            }
        return None

    # --- Enregistrement -----------------------------------------------------------

    def flush(self):
        snapshot, self.snapshot = self.snapshot, None
        if not snapshot or snapshot['key'] in self.logged:
            return
        threshold = int(setting('threshold') or '85') / 100.0
        if snapshot['total'] <= 0 or snapshot['position'] / snapshot['total'] < threshold:
            return
        try:
            self.record(snapshot)
            self.logged.add(snapshot['key'])
        except SpoilerError as error:
            log('échec: {}'.format(error), xbmc.LOGWARNING)
            notify('Échec : {}'.format(error), error=True)
        except Exception as error:  # noqa: BLE001 — le service ne doit pas mourir
            log('erreur inattendue: {}'.format(error), xbmc.LOGERROR)

    def record(self, snapshot):
        client = self.get_client()
        if client is None:
            notify('Extension non configurée', error=True)
            return
        resolver = TmdbResolver(setting('tmdb_token'))
        if snapshot['kind'] == 'movie':
            self.record_movie(client, resolver, snapshot)
        else:
            self.record_episode(client, resolver, snapshot)

    def record_movie(self, client, resolver, snapshot):
        tmdb_id = None
        title = snapshot['title']
        poster = None
        uniqueids = self.library_uniqueids('movie', snapshot['dbid'])
        raw = snapshot.get('uniqueid') or uniqueids.get('tmdb')
        if raw and str(raw).isdigit():
            tmdb_id = int(raw)
        elif resolver.available:
            found = None
            if uniqueids.get('imdb'):
                found = resolver.find_by_external('imdb_id', uniqueids['imdb'], 'movie')
            if not found:
                found = resolver.search_movie(title, snapshot.get('year') or None)
            if found:
                tmdb_id = found['id']
                title = found.get('title') or title
                poster = found.get('poster_path')
        if not tmdb_id:
            log('film non résolu: {}'.format(title), xbmc.LOGWARNING)
            return
        client.log_movie(tmdb_id, title, poster)
        notify('🎬 {} · vu ✓'.format(title))

    def record_episode(self, client, resolver, snapshot):
        show_tmdb = None
        show_name = snapshot['show']
        poster = None
        uniqueids = {}
        if snapshot['dbid'] and snapshot['dbid'] > 0:
            details = jsonrpc(
                'VideoLibrary.GetEpisodeDetails',
                {'episodeid': snapshot['dbid'], 'properties': ['tvshowid']},
            ).get('episodedetails') or {}
            tvshowid = details.get('tvshowid', -1)
            if tvshowid > 0:
                show = jsonrpc(
                    'VideoLibrary.GetTVShowDetails',
                    {'tvshowid': tvshowid, 'properties': ['uniqueid', 'title']},
                ).get('tvshowdetails') or {}
                uniqueids = show.get('uniqueid') or {}
                show_name = show.get('title') or show_name
        raw = uniqueids.get('tmdb')
        if raw and str(raw).isdigit():
            show_tmdb = int(raw)
        elif resolver.available:
            found = None
            if uniqueids.get('tvdb'):
                found = resolver.find_by_external('tvdb_id', uniqueids['tvdb'], 'tv')
            if not found and uniqueids.get('imdb'):
                found = resolver.find_by_external('imdb_id', uniqueids['imdb'], 'tv')
            if not found and show_name:
                found = resolver.search_tv(show_name)
            if found:
                show_tmdb = found['id']
                show_name = found.get('name') or show_name
                poster = found.get('poster_path')
        if not show_tmdb:
            log('série non résolue: {}'.format(show_name), xbmc.LOGWARNING)
            notify('Série non résolue : {}'.format(show_name), error=True)
            return
        client.log_episode(
            show_tmdb, show_name, snapshot['season'], snapshot['episode'], poster
        )
        notify(
            '📺 {} S{:02d}E{:02d} · vu ✓'.format(
                show_name, snapshot['season'], snapshot['episode']
            )
        )

    def library_uniqueids(self, kind, dbid):
        if not dbid or dbid <= 0:
            return {}
        if kind == 'movie':
            details = jsonrpc(
                'VideoLibrary.GetMovieDetails',
                {'movieid': dbid, 'properties': ['uniqueid']},
            ).get('moviedetails') or {}
            return details.get('uniqueid') or {}
        return {}


def main():
    log('démarrage')
    monitor = xbmc.Monitor()
    service = Service()
    if not service.is_configured():
        service.pair(monitor)
    while not monitor.abortRequested():
        service.poll()
        if monitor.waitForAbort(POLL_SECONDS):
            break
    service.flush()
    log('arrêt')


if __name__ == '__main__':
    main()
