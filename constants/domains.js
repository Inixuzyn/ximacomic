// constants/domains.js
module.exports = [
  {
    name: 'komiku',
    baseURL: 'https://komiku.id',
    isActive: true,
    config: {
      listSelector: '.daftar > .daftar > .bge > a',
      title: (el, $) => $(el).find('h3').text().trim(),
      thumb: (el, $) => $(el).find('img').attr('data-src') || $(el).find('img').attr('src'),
      details: (el, $, base) => $(el).attr('href')?.replace(base, '') || '',
      chapters: (el, $) => {
        const txt = $(el).find('.kan').text().trim();
        return parseFloat(txt.replace(/\D/g, '')) || 0;
      },
      type: (el, $) => 'Manga',
      rating: () => 0,
      searchPath: (q) => `/manga/?s=${encodeURIComponent(q)}`,
      listPath: '/manga/'
    }
  },
  {
    name: 'kiryuu',
    baseURL: 'https://kiryuu.id',
    isActive: true,
    config: {
      listSelector: '.daftar > .bixbox > .listupd > .bsx',
      title: (el, $) => $(el).find('a').attr('title') || '',
      thumb: (el, $) => $(el).find('img').attr('src')?.replace('/225/', '/160/') || '',
      details: (el, $, base) => $(el).find('a').attr('href')?.replace(base, '') || '',
      chapters: (el, $) => {
        const txt = $(el).find('.epxs').text().trim();
        return parseFloat(txt.replace(/\D/g, '')) || 0;
      },
      type: (el, $) => $(el).find('.type').text().trim() || 'Manga',
      rating: (el, $) => {
        const r = $(el).find('.num').text().trim();
        return parseFloat(r) || 0;
      },
      searchPath: (q) => `/?s=${encodeURIComponent(q)}&post_type=manga`,
      listPath: '/manga/'
    }
  },
  {
    name: 'shinigami',
    baseURL: 'https://shinigami.to',
    isActive: true,
    config: {
      listSelector: '.listupd > .bsx',
      title: (el, $) => $(el).find('a').attr('title') || '',
      thumb: (el, $) => $(el).find('img').attr('src')?.replace('/225x320/', '/160x227/') || '',
      details: (el, $, base) => $(el).find('a').attr('href')?.replace(base, '') || '',
      chapters: (el, $) => {
        const txt = $(el).find('.epxs').text().trim();
        return parseFloat(txt.replace(/\D/g, '')) || 0;
      },
      type: (el, $) => $(el).find('.type').text().trim() || 'Manga',
      rating: (el, $) => {
        const r = $(el).find('.rating i').text().trim();
        return parseFloat(r) || 0;
      },
      searchPath: (q) => `/?s=${encodeURIComponent(q)}&post_type=wp-manga`,
      listPath: '/manga/'
    }
  },
  {
    name: 'sektekomik',
    baseURL: 'https://sektekomik.my.id',
    isActive: true,
    config: {
      listSelector: '.listupd > .bsx',
      title: (el, $) => $(el).find('a').attr('title') || '',
      thumb: (el, $) => $(el).find('img').attr('src')?.replace('/225x320/', '/160x227/') || '',
      details: (el, $, base) => $(el).find('a').attr('href')?.replace(base, '') || '',
      chapters: (el, $) => {
        const txt = $(el).find('.epxs').text().trim();
        return parseFloat(txt.replace(/\D/g, '')) || 0;
      },
      type: (el, $) => $(el).find('.type').text().trim() || 'Manga',
      rating: (el, $) => {
        const r = $(el).find('.num').text().trim();
        return parseFloat(r) || 0;
      },
      searchPath: (q) => `/?s=${encodeURIComponent(q)}&post_type=wp-manga`,
      listPath: '/manga/'
    }
  },
  {
    name: 'komikcast',
    baseURL: 'https://komikcast.com',
    isActive: true,
    config: {
      listSelector: '.listupd .bsx',
      title: (el, $) => $(el).find('a').attr('title') || $(el).find('img').attr('alt') || '',
      thumb: (el, $) => $(el).find('img').attr('src')?.replace('225x320', '160x227') || '',
      details: (el, $, base) => $(el).find('a').attr('href')?.replace(base, '') || '',
      chapters: (el, $) => {
        const txt = $(el).find('.epxs').text().trim();
        return parseFloat(txt.replace(/\D/g, '')) || 0;
      },
      type: (el, $) => $(el).find('.type').text().trim() || 'Manga',
      rating: () => 0,
      searchPath: (q) => `/?s=${encodeURIComponent(q)}`,
      listPath: '/manga/'
    }
  }
]
