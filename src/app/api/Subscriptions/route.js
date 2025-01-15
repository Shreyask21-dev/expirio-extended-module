import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '../../../db';

// Enable CORS for preflight requests (OPTIONS)
export async function OPTIONS() {
  return NextResponse.json(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// GET request to fetch subscriptions with user, entity, service, payee details, and service duration from the database using Bearer token
export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    // Check if Authorization header is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // Extract token from Authorization header
    const token = authHeader.split(' ')[1];

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Query the database to fetch subscriptions, user details, entity details, service details, and payee info
    const [rows] = await db.execute(
      `SELECT subscriptions.*, users.username, users.sr AS user_id,
              entities.id AS entity_id, entities.entity_name,
              services.id AS service_id, services.service_name, services.min_duration AS service_duration,
              payees.payee_name, payees.email AS payee_email, payees.phone AS payee_phone
       FROM subscriptions
       JOIN users ON subscriptions.user_id = users.sr
       LEFT JOIN entities ON subscriptions.entity_id = entities.id
       LEFT JOIN services ON subscriptions.service_id = services.id
       LEFT JOIN payees ON subscriptions.payee_id = payees.id
       WHERE users.sr = ?`,
      [decoded.user_id]
    );

    // Check if there are subscriptions
    if (rows.length === 0) {
      return NextResponse.json({ message: 'No subscriptions found' }, { status: 404 });
    }

    // Send success response with fetched subscriptions, user details, entity details, service details, and payee info
    return NextResponse.json({
      message: 'Subscriptions fetched successfully',
      data: rows,
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return NextResponse.json({ message: 'Something went wrong', error: error.message }, { status: 500 });
  }
}


export async function POST(request) {
  try {
    // 1. Check for Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // 2. Extract and verify the token
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user_id = decoded.user_id;

    // 3. Parse the request body
    const body = await request.json();

    // Destructure the fields from the request body
    const { entity_name, service_name, payee_name, startDate, endDate, amount, paymentDate, category } = body;

    // 4. Validate required fields
    if (!entity_name || !service_name || !payee_name || !startDate || !endDate || !amount || !paymentDate || !category) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }

    // 5. Get IDs from names
    const [[entity]] = await db.execute('SELECT id FROM entities WHERE entity_name = ?', [entity_name]);
    const [[service]] = await db.execute('SELECT id FROM services WHERE service_name = ?', [service_name]);
    const [[payee]] = await db.execute('SELECT id FROM payees WHERE payee_name = ?', [payee_name]);

    // 6. Check if the IDs exist
    if (!entity || !service || !payee) {
      return NextResponse.json({ message: 'Invalid entity, service, or payee name' }, { status: 404 });
    }

    // 7. Insert the subscription into the database
    await db.execute(
      'INSERT INTO subscriptions (user_id, entity_id, service_id, payee_id, startDate, endDate, amount, paymentDate, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, entity.id, service.id, payee.id, startDate, endDate, amount, paymentDate, category]
    );

    // 8. Respond with success message
    return NextResponse.json({ message: 'Subscription created successfully' }, { status: 201 });

  } catch (error) {
    return NextResponse.json({ message: 'Something went wrong', error: error.message }, { status: 500 });
  }
}


export async function PUT(request) {
  try {
    // 1. Check for Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // 2. Extract and verify the token
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Parse the request body
    const body = await request.json();
    const { id, user_id, entity_name, service_name, payee_name, startDate, endDate, amount, paymentDate, category } = body;

    // 4. Validate ID and fields
    if (!id) {
      return NextResponse.json({ message: 'Subscription ID is required' }, { status: 400 });
    }

    // 5. Fetch IDs based on names if not directly provided
    let resolvedUserId = user_id || decoded.user_id;
    let entityId = null;
    let serviceId = null;
    let payeeId = null;

    if (entity_name) {
      const [[entity]] = await db.execute('SELECT id FROM entities WHERE entity_name = ?', [entity_name]);
      if (!entity) {
        return NextResponse.json({ message: 'Invalid entity name' }, { status: 404 });
      }
      entityId = entity.id;
    }

    if (service_name) {
      const [[service]] = await db.execute('SELECT id FROM services WHERE service_name = ?', [service_name]);
      if (!service) {
        return NextResponse.json({ message: 'Invalid service name' }, { status: 404 });
      }
      serviceId = service.id;
    }

    if (payee_name) {
      const [[payee]] = await db.execute('SELECT id FROM payees WHERE payee_name = ?', [payee_name]);
      if (!payee) {
        return NextResponse.json({ message: 'Invalid payee name' }, { status: 404 });
      }
      payeeId = payee.id;
    }

    // 6. Update the subscription
    await db.execute(
      `UPDATE subscriptions
       SET user_id = ?, entity_id = ?, service_id = ?, payee_id = ?, startDate = ?, endDate = ?, amount = ?, paymentDate = ?, category = ?
       WHERE id = ?`,
      [
        resolvedUserId,
        entityId,
        serviceId,
        payeeId,
        startDate,
        endDate,
        amount,
        paymentDate,
        category,
        id,
      ]
    );

    // 7. Respond with success message
    return NextResponse.json({ message: 'Subscription updated successfully' }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ message: 'Something went wrong', error: error.message }, { status: 500 });
  }
}


export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.user_id;

    const body = await request.json();
    const { id } = body; // Subscription ID

    if (!id) {
      return NextResponse.json({ message: 'Subscription ID is required' }, { status: 400 });
    }

    // Check if the subscription belongs to the user
    const [[subscription]] = await db.execute(
      'SELECT id FROM subscriptions WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    );

    if (!subscription) {
      return NextResponse.json({ message: 'Subscription not found or not authorized.' }, { status: 404 });
    }

    // Delete the subscription
    await db.execute('DELETE FROM subscriptions WHERE id = ?', [id]);

    return NextResponse.json({ message: 'Subscription deleted successfully.' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Something went wrong', error: error.message }, { status: 500 });
  }
}