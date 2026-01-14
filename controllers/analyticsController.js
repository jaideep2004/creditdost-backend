const googleAnalyticsService = require('../utils/googleAnalytics');

/**
 * Get website visitor statistics
 */
const getVisitorStats = async (req, res) => {
  try {
    const { period = '30daysAgo' } = req.query;
    
    // Get various analytics data in parallel
    const [
      realTimeVisitors,
      totalStats,
      chartData,
      topPages,
      trafficSources
    ] = await Promise.all([
      googleAnalyticsService.getRealTimeVisitors(),
      googleAnalyticsService.getTotalVisitors(period, 'today'),
      googleAnalyticsService.getVisitorsByDate(period, 'today'),
      googleAnalyticsService.getTopPages(5),
      googleAnalyticsService.getTrafficSources()
    ]);

    res.json({
      success: true,
      data: {
        realTimeVisitors,
        totalStats,
        chartData,
        topPages,
        trafficSources,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in getVisitorStats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visitor statistics',
      error: error.message
    });
  }
};

/**
 * Get real-time visitor count only
 */
const getRealTimeVisitors = async (req, res) => {
  try {
    const visitors = await googleAnalyticsService.getRealTimeVisitors();
    
    res.json({
      success: true,
      data: {
        realTimeVisitors: visitors,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in getRealTimeVisitors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch real-time visitors',
      error: error.message
    });
  }
};

/**
 * Get visitor trends for charts
 */
const getVisitorTrends = async (req, res) => {
  try {
    const { period = '30daysAgo' } = req.query;
    
    const chartData = await googleAnalyticsService.getVisitorsByDate(period, 'today');
    
    res.json({
      success: true,
      data: {
        chartData,
        period,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error in getVisitorTrends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visitor trends',
      error: error.message
    });
  }
};

module.exports = {
  getVisitorStats,
  getRealTimeVisitors,
  getVisitorTrends
};