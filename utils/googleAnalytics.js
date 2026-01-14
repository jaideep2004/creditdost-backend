const { BetaAnalyticsDataClient } = require('@google-analytics/data');

class GoogleAnalyticsService {
  constructor() {
    this.propertyId = process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
    
    // Initialize the client with service account credentials
    // Supports both file-based and environment variable-based authentication
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_CONTENT) {
      // Use credentials from environment variable
      try {
        const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_CONTENT);
        this.analyticsDataClient = new BetaAnalyticsDataClient({
          credentials: credentials
        });
      } catch (error) {
        console.error('Invalid JSON in GOOGLE_APPLICATION_CREDENTIALS_CONTENT:', error.message);
        console.error('Falling back to file-based authentication');
        this.analyticsDataClient = new BetaAnalyticsDataClient({
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './config/service-account-key.json'
        });
      }
    } else {
      // Use credentials from file (fallback)
      this.analyticsDataClient = new BetaAnalyticsDataClient({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || './config/service-account-key.json'
      });
    }
  }

  /**
   * Get real-time active users
   */
  async getRealTimeVisitors() {
    try {
      const [response] = await this.analyticsDataClient.runRealtimeReport({
        property: `properties/${this.propertyId}`,
        metrics: [
          {
            name: 'activeUsers',
          },
        ],
      });

      const activeUsers = response.rows?.[0]?.metricValues?.[0]?.value || '0';
      return parseInt(activeUsers);
    } catch (error) {
      console.error('Error fetching real-time visitors:', error);
      throw new Error('Failed to fetch real-time visitor data');
    }
  }

  /**
   * Get total visitors for a date range
   */
  async getTotalVisitors(startDate = '30daysAgo', endDate = 'today') {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        metrics: [
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' },
        ],
      });

      const metrics = response.rows?.[0]?.metricValues || [];
      
      return {
        totalUsers: parseInt(metrics[0]?.value || 0),
        pageViews: parseInt(metrics[1]?.value || 0),
        sessions: parseInt(metrics[2]?.value || 0),
        bounceRate: parseFloat(metrics[3]?.value || 0),
        avgSessionDuration: parseFloat(metrics[4]?.value || 0),
      };
    } catch (error) {
      console.error('Error fetching total visitors:', error);
      throw new Error('Failed to fetch visitor statistics');
    }
  }

  /**
   * Get visitors by date for chart data
   */
  async getVisitorsByDate(startDate = '30daysAgo', endDate = 'today') {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
        ],
      });

      const chartData = response.rows?.map(row => ({
        date: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        pageViews: parseInt(row.metricValues[1].value),
        sessions: parseInt(row.metricValues[2].value),
      })) || [];

      return chartData;
    } catch (error) {
      console.error('Error fetching visitors by date:', error);
      throw new Error('Failed to fetch visitor chart data');
    }
  }

  /**
   * Get top pages
   */
  async getTopPages(limit = 10) {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate: '30daysAgo',
            endDate: 'today',
          },
        ],
        dimensions: [
          { name: 'pageTitle' },
          { name: 'pagePath' },
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'uniquePageViews' },
        ],
        orderBys: [
          {
            metric: { name: 'screenPageViews' },
            desc: true,
          },
        ],
        limit,
      });

      const topPages = response.rows?.map(row => ({
        pageTitle: row.dimensionValues[0].value,
        pagePath: row.dimensionValues[1].value,
        pageViews: parseInt(row.metricValues[0].value),
        uniquePageViews: parseInt(row.metricValues[1].value),
      })) || [];

      return topPages;
    } catch (error) {
      console.error('Error fetching top pages:', error);
      throw new Error('Failed to fetch top pages data');
    }
  }

  /**
   * Get traffic sources
   */
  async getTrafficSources() {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate: '30daysAgo',
            endDate: 'today',
          },
        ],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
        ],
        orderBys: [
          {
            metric: { name: 'totalUsers' },
            desc: true,
          },
        ],
        limit: 10,
      });

      const trafficSources = response.rows?.map(row => ({
        source: row.dimensionValues[0].value,
        users: parseInt(row.metricValues[0].value),
        sessions: parseInt(row.metricValues[1].value),
      })) || [];

      return trafficSources;
    } catch (error) {
      console.error('Error fetching traffic sources:', error);
      throw new Error('Failed to fetch traffic sources data');
    }
  }
}

module.exports = new GoogleAnalyticsService();