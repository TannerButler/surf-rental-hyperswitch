# Surf Rental Checkout with Juspay Hyperswitch

A mobile-friendly surfboard rental prototype demonstrating an end-to-end online payment experience using Juspay Hyperswitch.

Live prototype: https://surf-rental-hyperswitch.vercel.app

## Overview

The prototype models a single-location surfboard rental business.

A customer can:

Choose a surfboard and rental duration  
→ select a rental date  
→ enter contact information  
→ review the persisted reservation  
→ complete payment through Hyperswitch Unified Checkout  
→ receive confirmation only after server-side payment verification

The project is intentionally scoped around the payment and reservation journey rather than broader rental-business features.

## Customer Flow

```text
Storefront
    ↓
POST /api/reservations
    ↓
Server calculates trusted price
    ↓
Review persisted reservation
    ↓
POST /api/payments
    ↓
Hyperswitch Unified Checkout
    ↓
Sandbox card payment
    ↓
Payment return page
    ↓
Server retrieves payment from Hyperswitch
    ↓
Verify payment ID + amount + currency + status
    ↓
Reservation confirmed