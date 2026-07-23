'use client';

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';
import { Download } from 'lucide-react';

interface SaleData {
  id: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  product: { name: string; sku: string };
  warehouse: { name: string };
  customer: { name: string; email?: string | null; phone?: string };
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  subtitle: { fontSize: 10, color: '#666', marginTop: 4 },
  badge: {
    padding: '4 8',
    borderRadius: 4,
    backgroundColor: '#e8f4fd',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0369a1',
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  label: { color: '#666' },
  value: { fontWeight: 'bold', color: '#1a1a1a' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: '8 12',
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderText: { fontWeight: 'bold', fontSize: 9, color: '#666', textTransform: 'uppercase' },
  tableRow: {
    flexDirection: 'row',
    padding: '10 12',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: '10 12',
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
    paddingTop: 12,
  },
  footerText: { fontSize: 8, color: '#999' },
  signatureBox: {
    width: 200,
    borderTopWidth: 0.5,
    borderTopColor: '#333',
    marginTop: 40,
    paddingTop: 8,
  },
  signatureLabel: { fontSize: 9, color: '#666' },
});

function SalesInvoicePDF({ data }: { data: SaleData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Sales Invoice</Text>
            <Text style={styles.subtitle}>StockPilot Retail</Text>
          </View>
          <View style={styles.badge}>
            <Text>{data.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{data.customer.name}</Text>
            </View>
            {data.customer.phone && (
              <View style={styles.row}>
                <Text style={styles.label}>Phone</Text>
                <Text style={styles.value}>{data.customer.phone}</Text>
              </View>
            )}
            {data.customer.email && (
              <View style={styles.row}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.value}>{data.customer.email}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Warehouse</Text>
              <Text style={styles.value}>{data.warehouse.name}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{new Date(data.createdAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Invoice #</Text>
              <Text style={styles.value}>{data.id.slice(0, 8).toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Line Items</Text>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableHeaderText, flex: 3 }}>Product</Text>
            <Text style={{ ...styles.tableHeaderText, flex: 1, textAlign: 'center' }}>Qty</Text>
            <Text style={{ ...styles.tableHeaderText, flex: 1, textAlign: 'right' }}>
              Unit Price
            </Text>
            <Text style={{ ...styles.tableHeaderText, flex: 1, textAlign: 'right' }}>Total</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={{ flex: 3, fontSize: 10, color: '#1a1a1a' }}>{data.product.name}</Text>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#1a1a1a' }}>
              {data.quantity}
            </Text>
            <Text style={{ flex: 1, textAlign: 'right', fontSize: 10, color: '#1a1a1a' }}>
              ${data.unitPrice.toFixed(2)}
            </Text>
            <Text
              style={{
                flex: 1,
                textAlign: 'right',
                fontSize: 10,
                color: '#1a1a1a',
                fontWeight: 'bold',
              }}
            >
              ${data.total.toFixed(2)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{ flex: 3, fontWeight: 'bold', color: '#1a1a1a' }}>Grand Total</Text>
            <Text style={{ flex: 1 }} />
            <Text style={{ flex: 1 }} />
            <Text
              style={{
                flex: 1,
                textAlign: 'right',
                fontWeight: 'bold',
                color: '#1a1a1a',
                fontSize: 12,
              }}
            >
              ${data.total.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 }}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Sold by</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Received by</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>StockPilot - Inventory Management</Text>
          <Text style={styles.footerText}>Generated {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function SalesInvoiceDownload({ sale }: { sale: SaleData }) {
  return (
    <PDFDownloadLink
      document={<SalesInvoicePDF data={sale} />}
      fileName={`invoice-${sale.id.slice(0, 8)}.pdf`}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }) => (
        <button
          className="btn btn-ghost"
          style={{ gap: 6, fontSize: 12, padding: '6px 10px', minHeight: 'auto' }}
          disabled={loading}
        >
          <Download style={{ width: 14, height: 14 }} />
          {loading ? 'Generating...' : 'Invoice'}
        </button>
      )}
    </PDFDownloadLink>
  );
}
