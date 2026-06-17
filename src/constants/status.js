export const PLANS = {
  STARTER: 'starter',
  GROWTH: 'growth',
  SCALE: 'scale',
}

export const PLAN_LIMITS = {
  starter: {
    assessments: 10,
    price: 0,
    label: 'Starter',
  },
  growth: {
    assessments: 100,
    price: 99.0,
    label: 'Growth',
  },
  scale: {
    assessments: 500,
    price: 299.0,
    label: 'Scale',
  },
}

export const RATE_LIMITS = {
  FREE: 10,
  PRO: 50,
  ENTERPRISE: Infinity,
}

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 50,
}

export const NOTIFICATIONS = {
  BADGE_MAX: 99,
  DROPDOWN_LIMIT: 10,
}

export const ASSESSMENT_LINK = {
  FREE_LIMIT: 10,
  SIGNED_URL_EXPIRY_HOURS: 48,
}