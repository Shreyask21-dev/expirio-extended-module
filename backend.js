// entities apis

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

// GET request to fetch entities with user details (username) from the database with Bearer token
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

    // Query the database to fetch entities with the username by joining 'users' and 'entities'
    const [rows] = await db.execute(
      `SELECT entities.*, users.username, users.sr AS user_id
       FROM entities
       JOIN users ON entities.user_id = users.sr
       WHERE users.sr = ?`,
      [decoded.user_id]
    );

    // Check if there are entities
    if (rows.length === 0) {
      return NextResponse.json({ message: 'No entities found' }, { status: 404 });
    }

    // Send success response with fetched entities and user details
    return NextResponse.json({
      message: 'Entities fetched successfully',
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


// POST request to create a new entity
export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    // Check if Authorization header is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // Extract token and verify
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Parse the request body
    const body = await request.json();
    const {
      entity_name,
      entity_desc,
      entity_short_desc,
      category,
    } = body;

    // Validate required fields
    if (!entity_name || !entity_desc || !entity_short_desc || !category) {
      return NextResponse.json(
        { message: 'Missing required fields: entity_name, entity_desc, entity_short_desc, and category are mandatory.' },
        { status: 400 }
      );
    }

    // Validate category
    if (!['income', 'expense'].includes(category.toLowerCase())) {
      return NextResponse.json(
        { message: 'Invalid category. Allowed values are "income" or "expense".' },
        { status: 400 }
      );
    }

    // Insert the new entity into the database
    const [result] = await db.execute(
      `INSERT INTO entities (user_id, entity_name, entity_desc, entity_short_desc, category)
       VALUES (?, ?, ?, ?, ?)`,
      [decoded.user_id, entity_name, entity_desc, entity_short_desc, category.toLowerCase()]
    );

    // Return success response
    return NextResponse.json(
      {
        message: 'Entity created successfully',
        data: {
          id: result.insertId,
          user_id: decoded.user_id,
          entity_name,
          entity_desc,
          entity_short_desc,
          category: category.toLowerCase(),
        },
      },
      {
        status: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    return NextResponse.json(
      { message: 'Something went wrong', error: error.message },
      { status: 500 }
    );
  }
}


export async function PUT(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    // Check if Authorization header is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // Extract token and verify
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user_id = decoded.user_id; // Extract user_id from the JWT

    // Parse the request body
    const body = await request.json();
    const {
      id, // ID of the entity to update
      entity_name,
      entity_desc,
      entity_short_desc,
      category
    } = body;

    // Validate required fields
    if (!id || !entity_name || !entity_desc || !entity_short_desc) {
      return NextResponse.json(
        { message: 'Missing required fields: id, entity_name, entity_desc, and entity_short_desc are mandatory.' },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (category && !['income', 'expense'].includes(category.toLowerCase())) {
      return NextResponse.json(
        { message: 'Invalid category. Allowed values are "income" or "expense".' },
        { status: 400 }
      );
    }

    // Check if the entity exists and belongs to the user
    const [existingEntity] = await db.execute(
      `SELECT * FROM entities WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, user_id]
    );

    if (existingEntity.length === 0) {
      return NextResponse.json(
        { message: 'Entity not found or does not belong to the user.' },
        { status: 404 }
      );
    }

    // Update the entity in the database
    await db.execute(
      `UPDATE entities
       SET entity_name = ?,
           entity_desc = ?,
           entity_short_desc = ?,
           category = ?
       WHERE id = ? AND user_id = ?`,
      [
        entity_name || existingEntity[0].entity_name,
        entity_desc || existingEntity[0].entity_desc,
        entity_short_desc || existingEntity[0].entity_short_desc,
        category ? category.toLowerCase() : existingEntity[0].category,
        id,
        user_id
      ]
    );

    // Return success response
    return NextResponse.json(
      { message: 'Entity updated successfully' },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    return NextResponse.json(
      { message: 'Something went wrong', error: error.message },
      { status: 500 }
    );
  }
}


export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    // Check if Authorization header is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // Extract token and verify
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user_id = decoded.user_id; // Extract user_id from the JWT

    // Parse the request body to get the entity ID
    const body = await request.json();
    const { entity_id } = body;

    // Validate required fields
    if (!entity_id) {
      return NextResponse.json(
        { message: 'Missing required field: entity_id is mandatory.' },
        { status: 400 }
      );
    }

    // Check if the entity exists and belongs to the user
    const [existingEntity] = await db.execute(
      `SELECT * FROM entities WHERE id = ? AND user_id = ? LIMIT 1`,
      [entity_id, user_id]
    );

    if (existingEntity.length === 0) {
      return NextResponse.json(
        { message: 'Entity not found or does not belong to the user.' },
        { status: 404 }
      );
    }

    // Delete related records in services, payees, and subscriptions
    await db.execute(`DELETE FROM services WHERE entity_id = ?`, [entity_id]);
    await db.execute(`DELETE FROM payees WHERE entity_id = ?`, [entity_id]);
    await db.execute(`DELETE FROM subscriptions WHERE entity_id = ?`, [entity_id]);

    // Delete the entity from the database
    await db.execute(
      `DELETE FROM entities WHERE id = ? AND user_id = ?`,
      [entity_id, user_id]
    );

    // Return success response
    return NextResponse.json(
      { message: 'Entity and related records deleted successfully.' },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    return NextResponse.json(
      { message: 'Something went wrong', error: error.message },
      { status: 500 }
    );
  }
}

// services api

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

// GET request to fetch services with user details (username) and entity details from the database with Bearer token
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

    // Query the database to fetch services with the username and entity details by joining 'users', 'services', and 'entities'
    const [rows] = await db.execute(
      `SELECT services.*, users.username, users.sr AS user_id, entities.id AS entity_id, entities.entity_name AS entity_name
       FROM services
       JOIN users ON services.user_id = users.sr
       LEFT JOIN entities ON services.entity_id = entities.id
       WHERE users.sr = ?`,
      [decoded.user_id]
    );

    // Check if there are services
    if (rows.length === 0) {
      return NextResponse.json({ message: 'No services found' }, { status: 404 });
    }

    // Send success response with fetched services, user details, and entity details
    return NextResponse.json({
      message: 'Services fetched successfully',
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


// POST request to create a new service with entity name resolution
export async function POST(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    // Check if Authorization header is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // Extract token and verify
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Parse the request body
    const body = await request.json();
    const {
      service_name,
      service_desc,
      entity_name, // User provides entity_name instead of entity_id
      min_duration,
      amount,
      category,
    } = body;

    // Validate required fields
    if (!service_name || !service_desc || !min_duration || !amount || !category || !entity_name) {
      return NextResponse.json(
        { message: 'Missing required fields: service_name, service_desc, min_duration, amount, category, and entity_name are mandatory.' },
        { status: 400 }
      );
    }

    // Validate category
    if (!['income', 'expense'].includes(category.toLowerCase())) {
      return NextResponse.json(
        { message: 'Invalid category. Allowed values are "income" or "expense".' },
        { status: 400 }
      );
    }

    // Fetch the entity_id based on entity_name
    const [entityRows] = await db.execute(
      `SELECT id FROM entities WHERE entity_name = ? LIMIT 1`,
      [entity_name]
    );

    if (entityRows.length === 0) {
      return NextResponse.json(
        { message: `Entity with name "${entity_name}" not found` },
        { status: 404 }
      );
    }

    const entity_id = entityRows[0].id;

    // Insert the new service into the database
    const [result] = await db.execute(
      `INSERT INTO services (user_id, entity_id, service_name, service_desc, min_duration, amount, category)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [decoded.user_id, entity_id, service_name, service_desc, min_duration, amount, category.toLowerCase()]
    );

    // Return success response
    return NextResponse.json(
      {
        message: 'Service created successfully',
        data: {
          id: result.insertId,
          user_id: decoded.user_id,
          entity_id,
          entity_name,
          service_name,
          service_desc,
          min_duration,
          amount,
          category: category.toLowerCase(),
        },
      },
      {
        status: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    return NextResponse.json(
      { message: 'Something went wrong', error: error.message },
      { status: 500 }
    );
  }
}


export async function PUT(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    // Check if Authorization header is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // Extract token and verify
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user_id = decoded.user_id; // Extract user_id from the JWT

    // Parse the request body
    const body = await request.json();
    const {
      id, // ID of the service to update
      entity_name, // User provides entity_name instead of entity_id
      service_name,
      service_desc,
      min_duration,
      amount,
      category
    } = body;

    // Validate required fields
    if (!id || !entity_name) {
      return NextResponse.json(
        { message: 'Missing required fields: id and entity_name are mandatory.' },
        { status: 400 }
      );
    }

    // Validate category if provided
    if (category && !['income', 'expense'].includes(category.toLowerCase())) {
      return NextResponse.json(
        { message: 'Invalid category. Allowed values are "income" or "expense".' },
        { status: 400 }
      );
    }

    // Fetch the entity_id based on entity_name
    const [entityRows] = await db.execute(
      `SELECT id FROM entities WHERE entity_name = ? LIMIT 1`,
      [entity_name]
    );

    if (entityRows.length === 0) {
      return NextResponse.json(
        { message: `Entity with name "${entity_name}" not found` },
        { status: 404 }
      );
    }

    const entity_id = entityRows[0].id;

    // Check if the service exists and belongs to the specified user and entity
    const [existingService] = await db.execute(
      `SELECT * FROM services WHERE id = ? AND user_id = ? AND entity_id = ? LIMIT 1`,
      [id, user_id, entity_id]
    );

    if (existingService.length === 0) {
      return NextResponse.json(
        { message: 'Service not found or does not belong to the specified user and entity.' },
        { status: 404 }
      );
    }

    // Update the service in the database
    await db.execute(
      `UPDATE services
       SET service_name = ?,
           service_desc = ?,
           min_duration = ?,
           amount = ?,
           category = ?
       WHERE id = ? AND user_id = ? AND entity_id = ?`,
      [
        service_name || existingService[0].service_name,
        service_desc || existingService[0].service_desc,
        min_duration || existingService[0].min_duration,
        amount || existingService[0].amount,
        category ? category.toLowerCase() : existingService[0].category,
        id,
        user_id,
        entity_id
      ]
    );

    // Return success response
    return NextResponse.json(
      { message: 'Service updated successfully' },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    return NextResponse.json(
      { message: 'Something went wrong', error: error.message },
      { status: 500 }
    );
  }
}


export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    // Check if Authorization header is present
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization token is missing or invalid' }, { status: 401 });
    }

    // Extract token and verify
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user_id = decoded.user_id; // Extract user_id from the JWT

    // Parse the request body to get the service ID
    const body = await request.json();
    const { id } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        { message: 'Missing required field: id is mandatory.' },
        { status: 400 }
      );
    }

    // Check if the service exists and belongs to the user
    const [existingService] = await db.execute(
      `SELECT * FROM services WHERE id = ? AND user_id = ? LIMIT 1`,
      [id, user_id]
    );

    if (existingService.length === 0) {
      return NextResponse.json(
        { message: 'Service not found or does not belong to the user.' },
        { status: 404 }
      );
    }

    // Delete related records in payees and subscriptions
    await db.execute(`DELETE FROM payees WHERE service_id = ?`, [id]);
    await db.execute(`DELETE FROM subscriptions WHERE service_id = ?`, [id]);

    // Delete the service from the database
    await db.execute(
      `DELETE FROM services WHERE id = ? AND user_id = ?`,
      [id, user_id]
    );

    // Return success response
    return NextResponse.json(
      { message: 'Service and related records deleted successfully' },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      }
    );

  } catch (error) {
    return NextResponse.json(
      { message: 'Something went wrong', error: error.message },
      { status: 500 }
    );
  }
}

// payee apis 

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


// subscription apis 

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
      return NextResponse.json({ message: 'Subscription ID is required' }, { status: 400 });
    }

    // 5. Verify subscription belongs to the user
    const [[subscription]] = await db.execute(
      'SELECT * FROM subscriptions WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!subscription) {
      return NextResponse.json({ message: 'Subscription not found or not authorized to delete' }, { status: 404 });
    }

    // 6. Delete the subscription
    await db.execute('DELETE FROM subscriptions WHERE id = ? AND user_id = ?', [id, userId]);

    // 7. Respond with success message
    return NextResponse.json({ message: 'Subscription deleted successfully' }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ message: 'Something went wrong', error: error.message }, { status: 500 });
  }
}
