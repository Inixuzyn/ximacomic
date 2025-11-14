import * as cheerio from 'cheerio'
import { join } from 'path'
import fetch from 'node-fetch'  // Import explicit untuk Node.js
import { slugs } from '../constants/blacklist'
import { baseURL } from '../constants/scraper'

// Delay untuk rate limiting (hindari ban)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Mendapatkan konten HTML dengan error handling
 * @param {string} path path/slug komik
 * @returns {CheerioStatic} $ atau empty cheerio
 */
async function getHTML(path = '') {
  try {
    const url = new URL(join(baseURL, path)).toString()
    console.log(`Fetching: ${url}`)  // Debug log
    
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id,en-US;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000  // 10 detik timeout
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText} untuk ${url}`)
    }

    const html = await res.text()
    await delay(1000)  // Rate limit 1 detik antar request
    return cheerio.load(html, null, false)
    
  } catch (error) {
    console.error(`❌ Error fetch ${path}:`, error.message)
    // Return empty cheerio biar nggak crash
    return cheerio.load('<html><body></body></html>')
  }
}

/**
 * Mendapatkan daftar komik (updated untuk komiku.id)
 * @param {object} query Query parameters
 * @param {number} maxResults Maksimal hasil (0-30)
 * @return {array */
async function getComics(query = {}, maxResults = 30) {
  const q = new URLSearchParams(query)
  const searchPath = query.s ? `/?s=${encodeURIComponent(query.s)}` : '/manga'
  const fullPath = searchPath + (Object.keys(query).length > 0 && !query.s ? `?${q}` : '')

  const $ = await getHTML(fullPath)

  // Selector untuk komiku.id - comic cards di list story
  const comicCards = $('.liststory > .item, .c-series > .series, .tablist .series-item')

  const comics = []

  comicCards.each((i, element) => {
    const card = $(element)
    
    // Extract data dengan fallback untuk berbagai layout
    const title = card.find('h3 a, .series-title a, .title a').first().attr('title') || 
                  card.find('h3, .title').first().text().trim()
    
    const link = card.find('a').first().attr('href')
    if (!title || !link) return  // Skip kalau kosong

    const thumb = card.find('img').first().attr('src') || 
                  card.find('img').first().attr('data-src') ||
                  'https://via.placeholder.com/160x225?text=No+Image'
    
    // Fix thumb size dan format
    const thumbUrl = thumb.replace(/w\d+/, 'w160').replace('225x', '160x')
    
    const details = link.replace(baseURL, '').replace(/\/$/, '')
    const type = card.find('.genre, .type').first().text().trim() || 'Manga'
    
    // Chapters - coba berbagai selector
    let chapters = 0
    const chapterText = card.find('.chapter, .epxs, .ch').first().text()
    if (chapterText) {
      chapters = parseFloat(chapterText.replace(/[^\d.]/g, '')) || 0
    }
    
    // Rating dengan fallback
    let rating = 0
    const ratingText = card.find('.rating, .score').first().text()
    if (ratingText) {
      rating = parseFloat(ratingText.replace(/[^\d.]/g, '')) || 0
    }

    // Filter blacklist
    const slug = details.split('/')[1] || details.split('/')[2]
    if (slugs.includes(slug)) return

    comics.push({
      type: type || 'Manga',
      title: title.substring(0, 100),  // Limit panjang
      thumb: thumbUrl,
      details,
      chapters: Math.max(0, chapters),
      rating: Math.min(10, Math.max(0, rating)),  // Clamp 0-10
      link: link,
      slug: slug
    })
  })

  // Sort by chapters descending (opsional)
  comics.sort((a, b) => b.chapters - a.chapters)
  
  return comics.slice(0, Math.min(maxResults || 30, 30))
    .filter(comic => comic.title && comic.details)
}

/**
 * Detail komik (updated selector untuk komiku.id)
 * @param {string} path path komik
 * @return {object} Detail komik
 */
async function getDetailsComic(path) {
  const $ = await getHTML(path)

  // Coba berbagai selector untuk info komik
  const infoSelectors = [
    '.post-content, .series-info, .bigcontent, .info-meta',
    '.series-meta, .manga-info, .detail-content'
  ]
  
  let info = null
  for (const selector of infoSelectors) {
    info = $(selector).first()
    if (info.length > 0) break
  }

  if (info.length === 0) {
    console.warn('⚠️ Info selector tidak ditemukan')
    return null
  }

  // Title dan thumbnail
  const title = info.find('h1, .series-title, .post-title').first().text().trim() ||
                $('title').text().replace(/ - Komiku.*/, '')
  
  const thumb = info.find('.thumb img, .series-cover img').first().attr('src') ||
                info.find('img').first().attr('src') ||
                'https://via.placeholder.com/250x350?text=No+Cover'

  // Description
  const description = info.find('.desc, .synopsis, .summary p').first().text().trim() ||
                      'Deskripsi tidak tersedia'

  // Genres
  const genres = []
  info.find('a[href*="/genre/"], .genre-tags a, .tag a').each((i, el) => {
    const genre = $(el).text().trim()
    if (genre && !genres.includes(genre)) {
      genres.push(genre)
    }
  })

  // Status, author, dll - dengan fallback
  const details = {
    title: title.substring(0, 150),
    thumb: thumb,
    description: description.substring(0, 500),
    genres: genres.slice(0, 10),  // Max 10 genres
    status: extractText(info, ['.status', '.spe span:contains("Status")'], 'Ongoing'),
    released: extractText(info, ['.released', '.spe span:contains("Released")'], 'N/A'),
    author: extractText(info, ['.author', '.spe span:contains("Author")'], 'Unknown'),
    type: extractText(info, ['.type', '.spe span:contains("Type")'], 'Manga'),
    rating: parseFloat(extractText(info, ['.rating strong', '.score'], '0')) || 0,
    chapters: []
  }

  // Chapters list
  const chapterSelectors = [
    '.list-chap > li, .chapter-list li, .bixbox ul li',
    '.chapters > ul > li, .listupd .bsx'
  ]

  for (const selector of chapterSelectors) {
    $(selector).each((i, element) => {
      const chapterLink = $(element).find('a').first()
      const chapterTitle = chapterLink.text().trim()
      const chapterPath = chapterLink.attr('href')
      
      if (chapterTitle && chapterPath) {
        details.chapters.push({
          title: chapterTitle,
          path: chapterPath.replace(baseURL, '/read'),
          number: parseFloat(chapterTitle.match(/Ch\.?\s*(\d+(?:\.\d+)?)/)?.[1]) || i + 1
        })
      }
    })
    
    if (details.chapters.length > 0) break
  }

  // Sort chapters descending (terbaru dulu)
  details.chapters.sort((a, b) => b.number - a.number)
  
  // Limit chapters ke 50 terbaru
  details.chapters = details.chapters.slice(0, 50)
  
  console.log(`✅ Detail loaded: ${details.title} (${details.chapters.length} chapters)`)
  return details
}

/**
 * Extract text dengan multiple selector
 * @param {Cheerio} container Container element
 * @param {array} selectors Array of CSS selectors
 * @param {string} fallback Default value
 * @returns {string}
 */
function extractText(container, selectors, fallback = '') {
  for (const selector of selectors) {
    const element = container.find(selector).first()
    if (element.length > 0) {
      let text = element.text().trim()
      // Clean text - ambil setelah label
      text = text.split(':')[1]?.trim() || text.split(' ')[1]?.trim() || text
      return text || fallback
    }
  }
  return fallback
}

/**
 * Halaman/gambar chapter (updated untuk komiku.id)
 * @param {string} path path chapter
 * @returns {object} Pages data
 */
async function getPagesOfComic(path) {
  const $ = await getHTML(path)

  // Title chapter
  const title = $('.headpost h1, .chapter-title, h1').first().text().trim() ||
                $('title').text()

  // Pages - coba berbagai selector untuk images
  const pageSelectors = [
    '#readerarea img, .reader img, .chapter-content img',
    '.reading-content img, #image-container img',
    '.page-image img, .manga-page img'
  ]

  const pages = []
  
  for (const selector of pageSelectors) {
    $(selector).each((i, element) => {
      let imageSrc = $(element).attr('src') || $(element).attr('data-src')
      
      // Skip iklan atau gambar kecil
      if (imageSrc && !imageSrc.includes('ads') && 
          !imageSrc.includes('banner') && 
          imageSrc.match(/\.(jpg|jpeg|png|webp)$/i)) {
        
        // Fix URL absolut
        if (imageSrc.startsWith('//')) {
          imageSrc = 'https:' + imageSrc
        } else if (imageSrc.startsWith('/')) {
          imageSrc = baseURL + imageSrc
        }
        
        pages.push({
          src: imageSrc,
          page: i + 1,
          width: $(element).attr('width') || 800,
          height: $(element).attr('height') || 1200
        })
      }
    })
    
    if (pages.length > 0) break
  }

  // Pagination
  const pagination = {
    prev: null,
    next: null,
    current: 1,
    total: pages.length
  }

  // Coba extract pagination links
  const prevLink = $('a[rel="prev"], .prev-page, .pagination .prev').first().attr('href')
  const nextLink = $('a[rel="next"], .next-page, .pagination .next').first().attr('href')
  
  if (prevLink) pagination.prev = prevLink.replace(baseURL, '/read')
  if (nextLink) pagination.next = nextLink.replace(baseURL, '/read')

  // Fallback kalau nggak ada pagination
  if (pages.length === 0) {
    console.warn('⚠️ No pages found, mungkin chapter locked atau selector salah')
    pages.push({
      src: 'https://via.placeholder.com/800x1200?text=Chapter+Not+Available',
      page: 1,
      width: 800,
      height: 1200
    })
  }

  console.log(`📄 Pages loaded: ${pages.length} images for "${title}"`)
  
  return {
    title,
    pagination,
    pages
  }
}

/**
 * Validasi max results
 * @param {number|string} num Input number
 * @return {number}
 */
function max(num) {
  const n = parseInt(num) || 30
  return Math.max(0, Math.min(n, 30))  // Clamp 0-30
}

// Export functions
export { getComics, getDetailsComic, getPagesOfComic, max }
export default { getComics, getDetailsComic, getPagesOfComic, max }

// CommonJS export untuk compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getComics,
    getDetailsComic,
    getPagesOfComic,
    max
  }
}

