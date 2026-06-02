const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const LICENSE_SECRET = process.env.LICENSE_SECRET || 'shllshockd-pro-secret-key-v1'
const ALGORITHM = 'sha256'

let userDataPath = null

function setUserDataPath(dataPath) {
  userDataPath = dataPath
}

function getLicensePath() {
  if (!userDataPath) throw new Error('User data path not set')
  return path.join(userDataPath, 'license.json')
}

function initLicenseFile() {
  try {
    const licensePath = getLicensePath()
    if (!fs.existsSync(licensePath)) {
      fs.writeFileSync(licensePath, JSON.stringify({
        licenseKey: null,
        email: null,
        purchasedAt: null,
        status: 'unlicensed'
      }, null, 2))
      console.log(`[license] Created ${licensePath}`)
    }
  } catch (err) {
    console.error(`[license] Init error: ${err.message}`)
  }
}

function generateLicenseKey(email) {
  const timestamp = Date.now()
  const data = `${email}:${timestamp}`
  const hmac = crypto.createHmac(ALGORITHM, LICENSE_SECRET)
  hmac.update(data)
  const signature = hmac.digest('hex').substring(0, 16)
  return `SHLLSHOCKD-${timestamp}-${signature}`.toUpperCase()
}

function validateLicenseKey(licenseKey, email) {
  try {
    if (!licenseKey || typeof licenseKey !== 'string') {
      return { valid: false, error: 'Invalid license key format' }
    }

    const parts = licenseKey.split('-')
    if (parts.length < 3 || parts[0] !== 'SHLLSHOCKD') {
      return { valid: false, error: 'Invalid license key format' }
    }

    const timestamp = parseInt(parts[1], 10)
    const signature = parts[2]

    if (isNaN(timestamp) || !signature) {
      return { valid: false, error: 'Invalid license key format' }
    }

    const data = `${email}:${timestamp}`
    const hmac = crypto.createHmac(ALGORITHM, LICENSE_SECRET)
    hmac.update(data)
    const expectedSignature = hmac.digest('hex').substring(0, 16).toUpperCase()

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid license key or email mismatch' }
    }

    return {
      valid: true,
      email,
      purchasedAt: timestamp,
      expiresAt: null,
    }
  } catch (err) {
    return { valid: false, error: err.message }
  }
}

function loadLicense() {
  try {
    const licensePath = getLicensePath()
    if (!fs.existsSync(licensePath)) return null
    const data = fs.readFileSync(licensePath, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    console.error(`[license] Load error: ${err.message}`)
    return null
  }
}

function saveLicense(licenseData) {
  try {
    const licensePath = getLicensePath()
    fs.writeFileSync(licensePath, JSON.stringify(licenseData, null, 2))
    console.log(`[license] Saved license for ${licenseData.email}`)
    return true
  } catch (err) {
    console.error(`[license] Save error: ${err.message}`)
    return false
  }
}

function getLicenseStatus() {
  const license = loadLicense()
  if (!license || !license.licenseKey || !license.email) {
    return { status: 'unlicensed', pro: false }
  }

  const validation = validateLicenseKey(license.licenseKey, license.email)
  if (!validation.valid) {
    return { status: 'invalid', pro: false, error: validation.error }
  }

  return {
    status: 'valid',
    pro: true,
    email: license.email,
    purchasedAt: license.purchasedAt,
  }
}

function activateLicense(licenseKey, email) {
  // Validate the key first
  const validation = validateLicenseKey(licenseKey, email)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  // Save the license
  const licenseData = {
    licenseKey,
    email,
    purchasedAt: validation.purchasedAt,
    status: 'valid',
  }

  if (saveLicense(licenseData)) {
    console.log(`[license] Activated license for ${email}`)
    return { success: true, email, purchasedAt: validation.purchasedAt }
  } else {
    return { success: false, error: 'Failed to save license' }
  }
}

function deactivateLicense() {
  const licenseData = {
    licenseKey: null,
    email: null,
    purchasedAt: null,
    status: 'unlicensed',
  }
  if (saveLicense(licenseData)) {
    console.log(`[license] Deactivated license`)
    return { success: true }
  } else {
    return { success: false, error: 'Failed to deactivate license' }
  }
}

module.exports = {
  setUserDataPath,
  initLicenseFile,
  generateLicenseKey,
  validateLicenseKey,
  loadLicense,
  saveLicense,
  getLicenseStatus,
  activateLicense,
  deactivateLicense,
}
