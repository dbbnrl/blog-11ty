// Modified from https://github.com/hnrklssn/markdown-it-sidenote
// Process sidenotes
//
'use strict';

////////////////////////////////////////////////////////////////////////////////
// Renderer partials

function render_sidenote_anchor_name(tokens, idx, options, env/*, slf*/) {
  var n = Number(tokens[idx].meta.id + 1).toString();
  var prefix = '';

  if (typeof env.docId === 'string') {
    prefix = '-' + env.docId + '-';
  }

  return prefix + n;
}

function render_sidenote_caption(tokens, idx/*, options, env, slf*/) {
  var n = Number(tokens[idx].meta.id + 1).toString();

  return '<sup class=sidenote-number>' + n + '</sup>';
}

function render_sidenote_ref(tokens, idx, options, env, slf) {
  var id      = slf.rules.sidenote_anchor_name(tokens, idx, options, env, slf);
  var caption = slf.rules.sidenote_caption(tokens, idx, options, env, slf);
  var refid   = id;

  if (tokens[idx].meta.subId > 0) {
    refid += ':' + tokens[idx].meta.subId;
  }

  return `<label aria-describedby="fn${id}" role="presentation" class="sidelink" for="fn${id}-content">
<output class="highlight fnref" id="fnref${refid}">${caption}
</output></label>`;
}
  /*
  return `<label aria-describedby="fn${id}" role="presentation" class="sidelink" for="fn${id}-content">
<a aria-hidden="true" href="#fn${id}"><output class="highlight fnref" id="fnref${refid}">${caption}
</output></a></label>`;
*/

function render_sidenote_open(tokens, idx, options, env, slf) {
  var id = slf.rules.sidenote_anchor_name(tokens, idx, options, env, slf);

  if (tokens[idx].meta.subId > 0) {
    id += ':' + tokens[idx].meta.subId;
  }

  return `<aside id="fn${id}" class="sidenote" role="note">
    <output aria-hidden="true" class="highlight" id="fn${id}-content">
    <label role="presentation" for="fnref${id}">`;
}

function render_sidenote_close() {
  return '</label></output></aside>\n';
}

function render_sidenote_anchor(tokens, idx, options, env, slf) {
  var id = slf.rules.sidenote_anchor_name(tokens, idx, options, env, slf);

  if (tokens[idx].meta.subId > 0) {
    id += ':' + tokens[idx].meta.subId;
  }

  /* ↩ with escape code to prevent display as Apple Emoji on iOS */
  return ' <a href="#fnref' + id + '" class="sidenote-backref">\u21a9\uFE0E</a>';
}


module.exports = function sidenote_plugin(md) {
  var parseLinkLabel = md.helpers.parseLinkLabel;

  md.renderer.rules.sidenote_ref          = render_sidenote_ref;
  md.renderer.rules.sidenote_open         = render_sidenote_open;
  md.renderer.rules.sidenote_close        = render_sidenote_close;
  md.renderer.rules.sidenote_anchor       = render_sidenote_anchor;

  // helpers (only used in other rules, no tokens are attached to those)
  md.renderer.rules.sidenote_caption      = render_sidenote_caption;
  md.renderer.rules.sidenote_anchor_name  = render_sidenote_anchor_name;

  // Process inline sidenotes (^[...])
  function sidenote_inline(state, silent) {
    var labelStart,
        labelEnd,
        sidenoteId,
        token,
        tokens = [],
        max = state.posMax,
        start = state.pos;

    if (start + 2 >= max) { return false; }
    if (state.src.charCodeAt(start) !== 0x5E/* ^ */) { return false; }
    if (state.src.charCodeAt(start + 1) !== 0x5B/* [ */) { return false; }

    labelStart = start + 2;
    labelEnd = parseLinkLabel(state, start + 1);

    // parser failed to find ']', so it's not a valid note
    if (labelEnd < 0) { return false; }

    // We found the end of the link, and know for a fact it's a valid link;
    // so all that's left to do is to call tokenizer.
    //
    if (!silent) {
      if (!state.env.sidenotes) { state.env.sidenotes = {}; }
      if (!state.env.sidenotes.list) { state.env.sidenotes.list = []; }
      sidenoteId = state.env.sidenotes.list.length;

      state.md.inline.parse(
        state.src.slice(labelStart, labelEnd),
        state.md,
        state.env,
        tokens
      );

      token      = state.push('sidenote_ref', '', 0);
      token.meta = { id: sidenoteId };

      state.env.sidenotes.list[sidenoteId] = {
        content: state.src.slice(labelStart, labelEnd),
        tokens
      };
      //console.log(state.env.sidenotes.list[sidenoteId]);
    }

    state.pos = labelEnd + 1;
    state.posMax = max;
    return true;
  }

  function contains_sidenote(tok) {
    return tok.children && tok.children.some(child => child.type === 'sidenote_ref');
  }

  function num_sidenotes(tok) {
    if (!tok.type === 'inline') return 0;
    if (!tok.children) return 0;
    const l = tok.children.filter(child => child.type === 'sidenote_ref');
    return l.length;
  }

  function create_sidenote_list_element(state, sidenote, i) {
    const tokens = [];
    var token      = new state.Token('sidenote_open', '', 1);
    token.meta = { id: i, label: sidenote.label };
    tokens.push(token);

    if (sidenote.tokens) {
      token          = new state.Token('paragraph_open', 'p', 1);
      token.block    = true;
      tokens.push(token);

      token          = new state.Token('sidenote_caption', '', 1);
      token.meta = { id: i };
      tokens.push(token);

      token          = new state.Token('inline', '', 0);
      token.children = sidenote.tokens;
      token.content  = sidenote.content;
      tokens.push(token);

      token          = new state.Token('paragraph_close', 'p', -1);
      token.block    = true;
      tokens.push(token);
    }

    /*
    let lastParagraph;
    if (tokens[tokens.length - 1].type === 'paragraph_close') {
      lastParagraph = tokens.pop();
    } else {
      lastParagraph = null;
    }

    const t = sidenote.count > 0 ? sidenote.count : 1;
    for (let j = 0; j < t; j++) {
      token      = new state.Token('sidenote_anchor', '', 0);
      token.meta = { id: i, subId: j, label: sidenote.label };
      tokens.push(token);
    }

    if (lastParagraph) {
      tokens.push(lastParagraph);
    }
    */

    token = new state.Token('sidenote_close', '', -1);
    tokens.push(token);
    return tokens;
  }

  // Glue sidenote tokens to end of paragraph
  function sidenote_tail(state) {
    if (!state.env.sidenotes) { return; }

    const sidenotes = state.env.sidenotes.list;
    const stack = [];
    let index = 0;
    while (sidenotes.length) {
      //const sidenote = sidenotes.pop();
      let tok = state.tokens.shift();
      let num = num_sidenotes(tok);
      // search for sidenote reference
      while (!num) {
        stack.push(tok);
        tok = state.tokens.shift();
        num = num_sidenotes(tok);
      }
      if (!contains_sidenote(tok)) {
        throw new Error('missing sidenote ref');
      }
      // search for end of paragraph containing sidenote ref
      while (tok.type !== 'paragraph_close') {
        stack.push(tok);
        tok = state.tokens.shift();
        num += num_sidenotes(tok);
      }
      stack.push(tok);
      while (num && sidenotes.length) {
        const sidenote = sidenotes.shift();
        const sidenote_tokens = create_sidenote_list_element(state, sidenote, index);
        stack.push(...sidenote_tokens); // insert sidenote content after end of paragraph
        index++;
        num--;
      }
    }
    state.tokens.unshift(...stack);
    //return true
  }

  md.inline.ruler.after('image', 'sidenote_inline', sidenote_inline);
  md.core.ruler.after('inline', 'sidenote_tail', sidenote_tail);
};
