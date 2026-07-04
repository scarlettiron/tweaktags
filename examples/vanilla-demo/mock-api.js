//TweakTags
//Licensed under the MIT License. See the LICENSE file in the project root.
//Copyright (c) 2026 Scarlett A. Scott (codescarlett)
//
//Contributors:
//Scarlett A. Scott (codescarlett)

//A tiny in memory backend for the demo pages. It patches window.fetch so the
//vanilla build has something real to talk to, with no server to run. State lives
//in memory, so a reload signs you out and resets the tags.
(function () {
  var users = [{ email: 'admin@example.com', password: 'password', role: 'superuser' }];

  var content = {
    'hero-title': { tag: 'hero-title', type: 'plain', body: 'Welcome to TweakTags', mediaUrl: null, updatedAt: null, updatedBy: null },
    'hero-subtitle': { tag: 'hero-subtitle', type: 'rich', body: 'Edit <b>me</b> right on the page.', mediaUrl: null, updatedAt: null, updatedBy: null },
    'hero-banner': { tag: 'hero-banner', type: 'media', body: '', mediaUrl: 'https://picsum.photos/seed/tweaktags/1200/320', updatedAt: null, updatedBy: null },
  };

  var session = null;

  function res(status, data) {
    return Promise.resolve({
      ok: status < 400,
      status: status,
      json: function () {
        return Promise.resolve(data);
      },
    });
  }

  window.fetch = function (_url, init) {
    var message;

    try {
      message = JSON.parse(init.body);
    } catch (error) {
      return res(400, { message: 'Bad request body' });
    }

    var action = message.action;
    var p = message.payload || {};

    switch (action) {
      case 'login': {
        var match = users.filter(function (u) {
          return u.email === p.email && u.password === p.password;
        })[0];

        if (!match) {
          return res(401, { message: 'Wrong email or password.' });
        }

        session = { id: '1', email: match.email, role: match.role };

        return res(200, { accessToken: 'demo', refreshToken: 'demo', user: session });
      }

      case 'me':
        return session ? res(200, { user: session }) : res(401, { message: 'Not signed in' });

      case 'logout':
        session = null;

        return res(200, { ok: true });

      case 'refresh':
        return session
          ? res(200, { accessToken: 'demo', refreshToken: 'demo', user: session })
          : res(401, { message: 'Session expired' });

      case 'getContent':
        return res(200, {
          content: (p.tags || [])
            .map(function (tag) {
              return content[tag];
            })
            .filter(Boolean),
        });

      case 'listTags':
        return res(200, { tags: Object.keys(content).sort() });

      case 'createTag': {
        if (!session || session.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can create tags' });
        }

        if (content[p.tag]) {
          return res(409, { message: 'The tag "' + p.tag + '" already exists' });
        }

        content[p.tag] = { tag: p.tag, type: p.type || 'plain', body: '', mediaUrl: null, updatedAt: null, updatedBy: '1' };

        return res(201, { content: content[p.tag] });
      }

      case 'updateContent': {
        if (!session) {
          return res(401, { message: 'Sign in first' });
        }

        var existing = content[p.tag];
        content[p.tag] = {
          tag: p.tag,
          type: existing ? existing.type : 'plain',
          body: p.body,
          mediaUrl: p.mediaUrl == null ? null : p.mediaUrl,
          updatedAt: 'now',
          updatedBy: '1',
        };

        return res(200, { content: content[p.tag] });
      }

      case 'updateTagType': {
        if (!session || session.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can change a tag type' });
        }

        if (!content[p.tag]) {
          return res(404, { message: 'The tag does not exist' });
        }

        content[p.tag].type = p.type;

        return res(200, { content: content[p.tag] });
      }

      case 'deleteTag': {
        if (!session || session.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can delete tags' });
        }

        delete content[p.tag];

        return res(200, { ok: true, tag: p.tag });
      }

      default:
        return res(400, { message: 'Unknown action ' + action });
    }
  };

  console.log('[TweakTags demo] Mock backend ready. Sign in with admin@example.com / password');
})();
