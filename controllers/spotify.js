import axios from 'axios';
import getOriginalAlbumTracks from '../utils/discogs.js';
import { Router } from 'express';
const spotifyRouter = Router();

import { playTracks, queueTracks } from '../utils/spotifyUtils.js';
import { combineTrackLists } from '../utils/stringUtils.js';
import { getSpotifyUser, findDbPreference, findUser } from '../utils/dbMiddleware.js';

// Ensure a proper token is given for each request to this route
spotifyRouter.use((req, res, next) => {
  const auth = req.headers['authorization'];

  if (auth === '') {
    return res.status(401).send('No Spotify auth token given in header');
  }
  else if (!auth.startsWith('Bearer ')) {
    return res.status(401).send('Malformatted Spotify auth token given in header. Must be of format: Bearer <token>');
  }

  req.token = auth;
  next();
});

spotifyRouter.get('/search', (req, res, next) => {
  const query = req.query.q;

  // Prevent empty query request to Spotify API
  if (query === '') {
    return res.status(400).send('No search query');
  }

  axios
    .get(
      'https://api.spotify.com/v1/search', {
        params: {
          q: query,
          type: 'album'
        },
        headers: {
          'Authorization': req.token,
        }
      }
    )
    .then((response) => {
      res.status(200).json(response.data.albums.items);
    })
    .catch ((error) => {
      next(error);
    });
});

spotifyRouter.get('/play', [getSpotifyUser, findUser], async (req, res, next) => {
  const uri = req.query.uri;
  const token = req.token;

  // Get album id from uri
  const albumId = uri.split(':').at(-1);

  if (albumId === '') {
    return res.status(400).send('No album id specified');
  }

  try {
    const { preferencesExist, tracks } = await findDbPreference(albumId, req.user.id, token);

    if (preferencesExist) {
      const preferredTracks = tracks.filter(track => track.play);
      const queueResponse = await playTracks(preferredTracks, token);
      res.status(200).json(queueResponse);
    }
    else {
      const discogsTracks = await getOriginalAlbumTracks(albumId, token);

      // May return an empty array
      const masterTracks = combineTrackLists(tracks, discogsTracks);

      // Call Spotify middleware to play original track list
      const queueResponse = (masterTracks.length > 0) ?
        await playTracks(masterTracks, token) :
        await playTracks(tracks, token);

      res.status(200).json(queueResponse);
    }
  }
  catch(error) {
    next(error);
  }
});

spotifyRouter.get('/queue', [getSpotifyUser, findUser], async (req, res, next) => {
  const uri = req.query.uri;
  const token = req.token;

  // Get album id from uri
  const albumId = uri.split(':').at(-1);

  if (albumId === '') {
    return res.status(400).send('No album id specified');
  }

  try {
    const { preferencesExist, tracks } = await findDbPreference(albumId, req.user.id, token);

    if (preferencesExist) {
      const preferredTracks = tracks.filter(track => track.play);
      const queueResponse = await queueTracks(preferredTracks, token);
      res.status(200).json(queueResponse);
    }
    else {
      const discogsTracks = await getOriginalAlbumTracks(albumId, token);

      // May return an empty array
      const masterTracks = combineTrackLists(tracks, discogsTracks);

      // Call Spotify middleware to play original track list
      const queueResponse = (masterTracks.length > 0) ?
        await queueTracks(masterTracks, token) :
        await queueTracks(tracks, token);

      res.status(200).json(queueResponse);
    }
  }
  catch(error) {
    next(error);
  }
});

export default spotifyRouter;
