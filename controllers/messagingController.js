const pool = require('../config/db');

// Create Message Campaign
const createCampaign = async (req, res) => {
  const { funeral_id, message } = req.body;
  try {
    // Get all donors not yet contacted
    const donors = await pool.query(
      `SELECT DISTINCT d.phone_number, d.donor_name 
       FROM donations d 
       WHERE d.funeral_id = $1 
       AND d.is_deleted = FALSE
       AND d.phone_number NOT IN (
         SELECT ml.phone_number FROM message_logs ml
         LEFT JOIN message_campaigns mc ON ml.campaign_id = mc.id
         WHERE mc.funeral_id = $1 AND ml.status = 'Sent'
       )`,
      [funeral_id]
    );

    if (donors.rows.length === 0) {
      return res.status(400).json({ message: 'No new donors to contact' });
    }

    // Create campaign
    const campaign = await pool.query(
      'INSERT INTO message_campaigns (funeral_id, message, total_recipients, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [funeral_id, message, donors.rows.length, req.user.id]
    );

    // Add donors to message logs
    for (const donor of donors.rows) {
      await pool.query(
        'INSERT INTO message_logs (campaign_id, phone_number, donor_name) VALUES ($1, $2, $3)',
        [campaign.rows[0].id, donor.phone_number, donor.donor_name]
      );
    }

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign: campaign.rows[0],
      recipients: donors.rows.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Send Campaign Messages
const sendCampaign = async (req, res) => {
  const { campaign_id } = req.params;
  try {
    // Get pending messages
    const pending = await pool.query(
      'SELECT * FROM message_logs WHERE campaign_id = $1 AND status = $2',
      [campaign_id, 'Pending']
    );

    if (pending.rows.length === 0) {
      return res.status(400).json({ message: 'No pending messages in this campaign' });
    }

    // Get campaign message
    const campaign = await pool.query(
      'SELECT * FROM message_campaigns WHERE id = $1',
      [campaign_id]
    );

    let sentCount = 0;

    // Mark all as sent (Hubtel integration goes here)
    for (const log of pending.rows) {
      await pool.query(
        'UPDATE message_logs SET status = $1, sent_at = NOW() WHERE id = $2',
        ['Sent', log.id]
      );
      sentCount++;
    }

    // Update campaign
    await pool.query(
      'UPDATE message_campaigns SET sent_count = sent_count + $1, status = $2 WHERE id = $3',
      [sentCount, 'Sent', campaign_id]
    );

    res.json({
      message: `${sentCount} messages sent successfully`,
      sent_count: sentCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get All Campaigns
const getCampaigns = async (req, res) => {
  const { funeral_id } = req.params;
  try {
    const campaigns = await pool.query(
      'SELECT mc.*, u.full_name as created_by_name FROM message_campaigns mc LEFT JOIN users u ON mc.created_by = u.id WHERE mc.funeral_id = $1 ORDER BY mc.created_at DESC',
      [funeral_id]
    );
    res.json({ campaigns: campaigns.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get Campaign Logs
const getCampaignLogs = async (req, res) => {
  const { campaign_id } = req.params;
  try {
    const logs = await pool.query(
      'SELECT * FROM message_logs WHERE campaign_id = $1 ORDER BY sent_at DESC',
      [campaign_id]
    );
    res.json({ logs: logs.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createCampaign, sendCampaign, getCampaigns, getCampaignLogs };