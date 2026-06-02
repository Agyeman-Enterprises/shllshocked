import crypto from 'crypto'

// This is a client-side validator. The SECRET should be the same on both
// client and server (or server generates the key with this secret).
// In production, you'd generate keys server-side and just validate them here.

const LICENSE_SECRET = process.env.VITE_LICENSE_SECRET || 'shllshockd-pro-secret-key-v1'
const ALGORITHM = 'sha256'

/**
 * Generate a license key (server-side only, for admin)
 * Format: email-timestamp-hmac
 */
export function generateLicenseKey(email) {
  const timestamp = Date.now()
  const data = `${email}:${timestamp}`
  const hmac = crypto.createHmac(ALGORITHM, LICENSE_SECRET)
  hmac.update(data)
  const signature = hmac.digest('hex').substring(0, 16)
  return `SHLLSHOCKD-${timestamp}-${signature}`.toUpperCase()
}

/**
 * Validate a license key locally
 * Returns: { valid: boolean, email?: string, purchasedAt?: number, error?: string }
 */
export function validateLicenseKey(licenseKey, email) {
  try {
    if (!licenseKey || typeof licenseKey !== 'string') {
      return { valid: false, error: 'Invalid license key format' }
    }

    // Format: SHLLSHOCKD-timestamp-signature
    const parts = licenseKey.split('-')
    if (parts.length < 3 || parts[0] !== 'SHLLSHOCKD') {
      return { valid: false, error: 'Invalid license key format' }
    }

    const timestamp = parseInt(parts[1], 10)
    const signature = parts[2]

    if (isNaN(timestamp) || !signature) {
      return { valid: false, error: 'Invalid license key format' }
    }

    // Regenerate the signature to verify
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
      expiresAt: null, // perpetual license
    }
  } catch (err) {
    return { valid: false, error: err.message }
  }
}

/**
 * Parse stored license object and verify it's still valid
 */
export function checkStoredLicense(licenseObj) {
  if (!licenseObj || !licenseObj.licenseKey || !licenseObj.email) {
    return { valid: false, error: 'No valid license found' }
  }

  return validateLicenseKey(licenseObj.licenseKey, licenseObj.email)
}
