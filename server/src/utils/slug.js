const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/\+/g, 'plus').replace(/#/g, 'sharp').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
module.exports = { slugify };
