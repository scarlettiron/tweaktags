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
  var users = [
    { id: '1', email: 'admin@example.com', password: 'password', role: 'superuser' },
    { id: '2', email: 'editor@example.com', password: 'password', role: 'editor' },
  ];

  var nextUserId = 3;

  function publicUser(user) {
    return { id: user.id, email: user.email, role: user.role };
  }

  function byId(id) {
    return users.filter(function (user) {
      return user.id === id;
    })[0];
  }

  function byEmail(email) {
    return users.filter(function (user) {
      return user.email === email;
    })[0];
  }

  //The signed in user read back from the list rather than from the session, so a
  //role change or an email change takes effect straight away, the same way the
  //real handler reads the row instead of trusting the token.
  function currentUser() {
    return session ? byId(session.id) : null;
  }

  var content = {
    'hero-title': { tag: 'hero-title', type: 'plain', body: 'Welcome to TweakTags', mediaUrl: null, updatedAt: null, updatedBy: null },
    'hero-subtitle': { tag: 'hero-subtitle', type: 'rich', body: 'Edit <b>me</b> right on the page.', mediaUrl: null, updatedAt: null, updatedBy: null },
    'hero-banner': { tag: 'hero-banner', type: 'media', body: '', mediaUrl: 'https://picsum.photos/seed/tweaktags/1200/320', updatedAt: null, updatedBy: null },

    //The example component. Twelve tags across three cards, because a real site
    //is mostly components and each line in one is edited on its own.
    'card-one-eyebrow': { tag: 'card-one-eyebrow', type: 'plain', body: 'Most popular', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-one-title': { tag: 'card-one-title', type: 'plain', body: 'White Oak', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-one-body': { tag: 'card-one-body', type: 'plain', body: 'Rift and quartersawn, kiln dried to 7 percent. Sold by the board foot.', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-one-price': { tag: 'card-one-price', type: 'plain', body: '$14.50 / bf', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-two-eyebrow': { tag: 'card-two-eyebrow', type: 'plain', body: 'New this month', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-two-title': { tag: 'card-two-title', type: 'plain', body: 'Black Walnut', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-two-body': { tag: 'card-two-body', type: 'plain', body: 'Wide stock from our own yard, steamed or unsteamed. Ask for the figured lift.', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-two-price': { tag: 'card-two-price', type: 'plain', body: '$22.00 / bf', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-three-eyebrow': { tag: 'card-three-eyebrow', type: 'plain', body: 'Clearance', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-three-title': { tag: 'card-three-title', type: 'plain', body: 'Poplar Shorts', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-three-body': { tag: 'card-three-body', type: 'plain', body: 'Under four feet, paint grade, perfect for jigs and shop furniture.', mediaUrl: null, updatedAt: null, updatedBy: null },
    'card-three-price': { tag: 'card-three-price', type: 'plain', body: '$3.25 / bf', mediaUrl: null, updatedAt: null, updatedBy: null },
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
        var match = byEmail(p.email);

        if (!match || match.password !== p.password) {
          return res(401, { message: 'Wrong email or password.' });
        }

        session = publicUser(match);

        return res(200, { accessToken: 'demo', refreshToken: 'demo', user: session });
      }

      case 'me': {
        var me = currentUser();

        return me ? res(200, { user: publicUser(me) }) : res(401, { message: 'Not signed in' });
      }

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

      case 'listUsers': {
        var lister = currentUser();

        if (!lister) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (lister.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can manage users' });
        }

        return res(200, {
          users: users
            .map(publicUser)
            .sort(function (a, b) {
              return a.email.localeCompare(b.email);
            }),
        });
      }

      case 'createUser': {
        var creator = currentUser();

        if (!creator) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (creator.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can manage users' });
        }

        if (byEmail(p.email)) {
          return res(409, { message: 'A user with the email "' + p.email + '" already exists' });
        }

        var made = { id: String(nextUserId++), email: p.email, password: p.password, role: p.role };
        users.push(made);

        return res(201, { user: publicUser(made) });
      }

      case 'updateUserRole': {
        var promoter = currentUser();

        if (!promoter) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (promoter.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can manage users' });
        }

        if (p.userId === promoter.id) {
          return res(403, { message: 'You cannot change your own role' });
        }

        var promoted = byId(p.userId);

        if (!promoted) {
          return res(404, { message: 'That user could not be found' });
        }

        promoted.role = p.role;

        return res(200, { user: publicUser(promoted) });
      }

      case 'updateUserPassword': {
        var resetter = currentUser();

        if (!resetter) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (resetter.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can manage users' });
        }

        var reset = byId(p.userId);

        if (!reset) {
          return res(404, { message: 'That user could not be found' });
        }

        reset.password = p.password;

        return res(200, { ok: true });
      }

      case 'deleteUser': {
        var remover = currentUser();

        if (!remover) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (remover.role !== 'superuser') {
          return res(403, { message: 'Only a superuser can manage users' });
        }

        if (p.userId === remover.id) {
          return res(403, { message: 'You cannot delete your own account' });
        }

        var doomed = byId(p.userId);

        if (!doomed) {
          return res(404, { message: 'That user could not be found' });
        }

        //Judged on the role held right now, so removing an administrator is two
        //decisions: change them to an editor, then delete them.
        if (doomed.role === 'superuser') {
          return res(403, {
            message: 'A superuser cannot be deleted. Change their role to editor first.',
          });
        }

        users = users.filter(function (user) {
          return user.id !== doomed.id;
        });

        return res(200, { ok: true, userId: doomed.id });
      }

      case 'updateMyEmail': {
        var renamer = currentUser();

        if (!renamer) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        //403 rather than 401, matching the handler, so the api client does not
        //read a wrong password as an expired session and replay the request.
        if (renamer.password !== p.currentPassword) {
          return res(403, { message: 'Your current password is not correct' });
        }

        var clash = byEmail(p.email);

        if (clash && clash.id !== renamer.id) {
          return res(409, { message: 'A user with the email "' + p.email + '" already exists' });
        }

        renamer.email = p.email;
        session = publicUser(renamer);

        return res(200, { user: session });
      }

      case 'updateMyPassword': {
        var changer = currentUser();

        if (!changer) {
          return res(401, { message: 'You must be signed in to do this' });
        }

        if (changer.password !== p.currentPassword) {
          return res(403, { message: 'Your current password is not correct' });
        }

        changer.password = p.password;

        return res(200, { ok: true });
      }

      default:
        return res(400, { message: 'Unknown action ' + action });
    }
  };

  console.log('[TweakTags demo] Mock backend ready. Sign in as admin@example.com or editor@example.com, password "password".');
})();
