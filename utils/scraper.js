import * as cheerio from 'cheerio'
import { slugs } from '../constants/blacklist'
import DOMAINS from '../constants/domains'

async function fetchWithTimeout(url, timeout = 8000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(id)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } catch (err) {
    clearTimeout(id)
    throw err
  }
}

async function getHTML(baseURL, path = '') {
  const url = new URL(path, baseURL).href
  try {
    const html = await fetchWithTimeout(url)
    return cheerio.load(html)
  } catch (err) {
    console.warn(`[SCRAPER] Failed to fetch ${url}:`, err.message)
    return null
  }
}

function extractComics($, domain) {
  const comics = []
  const { config, baseURL } = domain

  $(config.listSelector).each((i, el) => {
    try {
      const title = config.title(el, $) || 'Tanpa Judul'
      if (!title || title === 'Tanpa Judul') return

      const thumb = config.thumb(el, $) || ''
      const details = config.details(el, $, baseURL)
      const chapters = config.chapters(el, $)
      const type = config.type(el, $)
      const rating = config.rating(el, $)

      const slug = details.split('/')[1] || ''
      if (slugs.includes(slug)) return

      comics.push({ type, title, thumb, details, chapters, rating })
    } catch (e) {
      console.warn(`[SCRAPER] Skip comic due to error:`, e.message)
    }
  })

  return comics
}

async function getComics(query = {}, maxResults = 30) {
  const q = query.s?.trim() || ''
  const limit = Math.min(Math.max(parseInt(maxResults) || 30, 1), 50)

  for (const domain of DOMAINS) {
    if (!domain.isActive) continue

    try {
      const path = q ? domain.config.searchPath(q) : domain.config.listPath
      const $ = await getHTML(domain.baseURL, path)
      if (!$) continue

      const comics = extractComics($, domain)
      if (comics.length > 0) {
        console.log(`✅ Scraped ${comics.length} comics from ${domain.name}`)
        return comics.slice(0, limit)
      }
    } catch (err) {
      console.warn(`[DOMAIN ${domain.name}] Failed:`, err.message)
    }
  }

  // Fallback: gabung semua (kalau partial success)
  const allComics = []
  for (const domain of DOMAINS) {
    if (!domain.isActive) continue
    try {
      const path = q ? domain.config.searchPath(q) : domain.config.listPath
      const $ = await getHTML(domain.baseURL, path)
      if ($) {
        const comics = extractComics($, domain)
        allComics.push(...comics)
      }
    } catch {}
  }

  return allComics
    .filter(c => c.title && c.title !== 'Tanpa Judul')
    .slice(0, limit)
}

async function getDetailsComic(path) {
  for (const domain of DOMAINS) {
    if (!domain.isActive) continue
    try {
      const $ = await getHTML(domain.baseURL, path)
      if (!$) continue

      // --- Komiku.id ---
      if (domain.name === 'komiku') {
        const $info = $('.infoz')
        const $thumb = $('.ims img')
        const $desc = $('.desc')
        const $genres = $('.genre a')
        const $chapters = $('#chapter_list > ul > li')

        const genres = []
        $genres.each((i, el) => genres.push($(el).text().trim()))

        const chapters = []
        $chapters.each((i, el) => {
          const $a = $(el).find('a')
          chapters.push({
            title: $a.text().trim(),
            path: $a.attr('href')?.replace(domain.baseURL, '/read') || ''
          })
        })

        const status = $info.text().match(/Status\s*:\s*([^\n]+)/i)?.[1] || 'Unknown'
        const author = $info.text().match(/Author\s*:\s*([^\n]+)/i)?.[1] || 'Unknown'
        const rating = parseFloat($('.rating strong').text()) || 0

        return {
          title: $thumb.attr('alt') || $('.entry-title').text().trim() || 'Tanpa Judul',
          thumb: $thumb.attr('src') || '',
          description: $desc.text().trim(),
          genres,
          status,
          author,
          rating,
          chapters: chapters.reverse()
        }
      }

      // --- Kiryuu.id / Shinigami.to / Sektekomik / Komikcast (mirip) ---
      const $content = domain.name === 'komikcast' ? $('.infox') : $('.infox, .sor')
      const $thumb = $('.thumb img, .ims img')
      const $genres = $('.genre-info a, .wd-full span a')
      const $chapters = $('.bixbox.bxcl ul li, .clstyle ul li, #chapter_list ul li')

      const genres = []
      $genres.each((i, el) => genres.push($(el).text().trim()))

      const chapters = []
      $chapters.each((i, el) => {
        const $a = $(el).find('a')
        const title = $a.text().trim()
        const href = $a.attr('href')?.replace(domain.baseURL, '/read') || ''
        if (title && href) chapters.push({ title, path: href })
      })

      let speText = $('.spe').text() + $('.imptdt').text()
      if (!speText) speText = $('body').text()

      const status = speText.match(/Status\s*[:：]?\s*([^\n,]+)/i)?.[1]?.trim() || 'Unknown'
      const author = speText.match(/Author\s*[:：]?\s*([^\n,]+)/i)?.[1]?.trim() || 'Unknown'
      const updated = speText.match(/Updated\s*[:：]?\s*([^\n,]+)/i)?.[1]?.trim() || ''
      const rating = parseFloat($('.rating strong, .numvotes').text().match(/[\d.]+/)?.[0]) || 0

      return {
        title: $thumb.attr('alt') || $('.entry-title').text().trim() || 'Tanpa Judul',
        thumb: $thumb.attr('src') || '',
        description: $('.desc, .desc-content, .entry-content').text().trim(),
        genres,
        status,
        author,
        updatedOn: updated,
        rating,
        chapters: chapters.reverse()
      }
    } catch (err) {
      console.warn(`[DETAIL ${domain.name}] Failed for ${path}:`, err.message)
    }
  }

  throw new Error('Tidak dapat mengambil detail komik dari semua domain')
}

async function getPagesOfComic(path) {
  for (const domain of DOMAINS) {
    if (!domain.isActive) continue
    try {
      const $ = await getHTML(domain.baseURL, path)
      if (!$) continue

      let title = $('.entry-title').text().trim()
      if (!title) title = $('title').text().replace(/–.+$/, '').trim()

      const pages = []
      // Selector universal untuk area pembaca
      $('#readerarea img, #chapter_body img, .img-responsive, .read-container img').each((i, el) => {
        const src = $(el).attr('src')?.trim()
        const dataSrc = $(el).attr('data-src')?.trim()
        const url = src || dataSrc
        if (url && !url.includes('blank') && !url.includes('placeholder')) {
          pages.push(url)
        }
      })

      // Pagination
      let prev = null, next = null
      if (domain.name === 'komiku') {
        prev = $('.prev a').attr('href')?.replace(domain.baseURL, '/read') || null
        next = $('.next a').attr('href')?.replace(domain.baseURL, '/read') || null
      } else {
        prev = $('.nav-links .prev a, .prevnext .prev a').attr('href')?.replace(domain.baseURL, '/read') || null
        next = $('.nav-links .next a, .prevnext .next a').attr('href')?.replace(domain.baseURL, '/read') || null
      }

      if (pages.length > 0) {
        console.log(`✅ Loaded ${pages.length} pages from ${domain.name}`)
        return { title, pagination: { prev, next }, pages }
      }
    } catch (err) {
      console.warn(`[PAGES ${domain.name}] Failed for ${path}:`, err.message)
    }
  }

  throw new Error('Tidak dapat memuat halaman komik dari semua domain')
}

module.exports = {
  getComics,
  getDetailsComic,
  getPagesOfComic
}
