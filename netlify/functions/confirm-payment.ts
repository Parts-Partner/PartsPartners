// netlify/functions/confirm-payment.ts
import { Handler } from '@netlify/functions';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { paymentIntentId } = JSON.parse(event.body || '{}');

    if (!paymentIntentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Payment Intent ID required' }),
      };
    }

    // Retrieve payment intent to check status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      }),
    };
  } catch (error: any) {
    console.error('Payment confirmation failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to confirm payment',
        message: error.message 
      }),
    };
  }
};