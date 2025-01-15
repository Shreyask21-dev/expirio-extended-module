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

// GET request to fetch payees with user details, entity and service details from the database using Bearer token
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

    // Query the database to fetch payees, user details, entity details, and service details
    const [rows] = await db.execute(
      `SELECT payees.*, users.username, users.sr AS user_id,
              entities.id AS entity_id, entities.entity_name,
              services.id AS service_id, services.service_name
       FROM payees
       JOIN users ON payees.user_id = users.sr
       LEFT JOIN entities ON payees.entity_id = entities.id
       LEFT JOIN services ON payees.service_id = services.id
       WHERE users.sr = ?`,
      [decoded.user_id]
    );

    // Check if there are payees
    if (rows.length === 0) {
      return NextResponse.json({ message: 'No payees found' }, { status: 404 });
    }

    // Send success response with fetched payees, user details, entity details, and service details
    return NextResponse.json({
      message: 'Payees fetched successfully',
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
    const { entity_name, service_name, payee_name, phone, email, amount, category } = body;

    // 4. Validate required fields
    if (!entity_name || !service_name || !payee_name || !phone || !email || !amount || !category) {
      return NextResponse.json({ message: 'All fields are required' }, { status: 400 });
    }

    // 5. Get IDs from names
    const [[entity]] = await db.execute('SELECT id FROM entities WHERE entity_name = ?', [entity_name]);
    const [[service]] = await db.execute('SELECT id FROM services WHERE service_name = ?', [service_name]);

    // 6. Check if the IDs exist
    if (!entity || !service) {
      return NextResponse.json({ message: 'Invalid entity or service name' }, { status: 404 });
    }

    // 7. Insert the payee into the database
    await db.execute(
      'INSERT INTO payees (user_id, entity_id, service_id, payee_name, phone, email, amount, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id, entity.id, service.id, payee_name, phone, email, amount, category]
    );

    // 8. Respond with success message
    return NextResponse.json({ message: 'Payee created successfully' }, { status: 201 });

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
    const userId = decoded.user_id;

    // 3. Parse the request body
    const body = await request.json();
    const { id, user_id, entity_name, service_name, payee_name, phone, email, amount, category } = body;

    // 4. Validate required fields
    if (!id) {
      return NextResponse.json({ message: 'Payee ID is required' }, { status: 400 });
    }

    // 5. Resolve IDs based on names if not provided
    const resolvedUserId = user_id || userId;
    let entityId = null;
    let serviceId = null;

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

    // 6. Update the payee record
    await db.execute(
      `UPDATE payees
       SET user_id = ?, entity_id = ?, service_id = ?, payee_name = ?, phone = ?, email = ?, amount = ?, category = ?
       WHERE id = ?`,
      [
        resolvedUserId,
        entityId,
        serviceId,
        payee_name,
        phone,
        email,
        amount,
        category,
        id,
      ]
    );

    // 7. Respond with success message
    return NextResponse.json({ message: 'Payee updated successfully' }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ message: 'Something went wrong', error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    // 1. Check for Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // 2. Extract and verify the token
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.user_id;

    // 3. Parse request body
    const body = await request.json();
    const { id } = body;

    // 4. Validate ID
    if (!id) {
      return NextResponse.json({ message: 'Payee ID is required' }, { status: 400 });
    }

    // 5. Verify payee belongs to the user
    const [[payee]] = await db.execute(
      'SELECT * FROM payees WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!payee) {
      return NextResponse.json({ message: 'Payee not found or not authorized to delete' }, { status: 404 });
    }

    // 6. Delete associated subscriptions
    await db.execute('DELETE FROM subscriptions WHERE payee_id = ?', [id]);

    // 7. Delete the payee record
    await db.execute('DELETE FROM payees WHERE id = ? AND user_id = ?', [id, userId]);

    // 8. Respond with success message
    return NextResponse.json({
      message: 'Payee and all associated subscriptions deleted successfully',
    }, { status: 200 });

  } catch (error) {
    return NextResponse.json({
      message: 'Something went wrong',
      error: error.message,
    }, { status: 500 });
  }
}
