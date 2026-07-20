'use client'

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer'
import { Download } from 'lucide-react'

interface TransferData {
  id: string
  product: { name: string; sku: string }
  fromWarehouse: { name: string } | null
  toWarehouse: { name: string }
  quantityInitiated: number
  trackingNumber: string | null
  notes: string | null
  createdAt: string
  shippedAt: string | null
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  subtitle: { fontSize: 10, color: '#666', marginTop: 4 },
  badge: { padding: '4 8', borderRadius: 4, backgroundColor: '#f0f0f0', fontSize: 9, fontWeight: 'bold', color: '#333' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#333', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  label: { color: '#666' },
  value: { fontWeight: 'bold', color: '#1a1a1a' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', padding: '8 12', borderRadius: 4, marginBottom: 4 },
  tableHeaderText: { fontWeight: 'bold', fontSize: 9, color: '#666', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: '10 12', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#ddd', paddingTop: 12 },
  footerText: { fontSize: 8, color: '#999' },
  signatureBox: { width: 200, borderTopWidth: 0.5, borderTopColor: '#333', marginTop: 40, paddingTop: 8 },
  signatureLabel: { fontSize: 9, color: '#666' },
})

function TransferOrderPDF({ data }: { data: TransferData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Transfer Order</Text>
            <Text style={styles.subtitle}>Packing Slip</Text>
          </View>
          <View style={styles.badge}>
            <Text>{data.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Product</Text>
            <Text style={styles.value}>{data.product.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>SKU</Text>
            <Text style={styles.value}>{data.product.sku}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Quantity</Text>
            <Text style={styles.value}>{data.quantityInitiated} units</Text>
          </View>
          {data.trackingNumber && (
            <View style={styles.row}>
              <Text style={styles.label}>Tracking #</Text>
              <Text style={styles.value}>{data.trackingNumber}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <View style={styles.row}>
            <Text style={styles.label}>From</Text>
            <Text style={styles.value}>{data.fromWarehouse?.name ?? '?'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>To</Text>
            <Text style={styles.value}>{data.toWarehouse.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Initiated</Text>
            <Text style={styles.value}>{new Date(data.createdAt).toLocaleDateString()}</Text>
          </View>
          {data.shippedAt && (
            <View style={styles.row}>
              <Text style={styles.label}>Shipped</Text>
              <Text style={styles.value}>{new Date(data.shippedAt).toLocaleDateString()}</Text>
            </View>
          )}
        </View>

        {data.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={{ color: '#333' }}>{data.notes}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 }}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureLabel}>Packed by</Text>
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
  )
}

export function TransferOrderDownload({ transfer }: { transfer: TransferData }) {
  return (
    <PDFDownloadLink
      document={<TransferOrderPDF data={transfer} />}
      fileName={`transfer-${transfer.id.slice(0, 8)}.pdf`}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }) => (
        <button className="btn btn-ghost" style={{ gap: 6, fontSize: 12, padding: '6px 10px', minHeight: 'auto' }} disabled={loading}>
          <Download style={{ width: 14, height: 14 }} />
          {loading ? 'Generating...' : 'Packing Slip'}
        </button>
      )}
    </PDFDownloadLink>
  )
}

// Receiving Report PDF
const receivingStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' },
  subtitle: { fontSize: 10, color: '#666', marginTop: 4 },
  badge: { padding: '4 8', borderRadius: 4, backgroundColor: '#e8f5e9', fontSize: 9, fontWeight: 'bold', color: '#2e7d32' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', color: '#333', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  label: { color: '#666' },
  value: { fontWeight: 'bold', color: '#1a1a1a' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f5f5f5', padding: '8 12', borderRadius: 4, marginBottom: 4 },
  tableHeaderText: { fontWeight: 'bold', fontSize: 9, color: '#666', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', padding: '10 12', borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  footer: { position: 'absolute', bottom: 40, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: '#ddd', paddingTop: 12 },
  footerText: { fontSize: 8, color: '#999' },
})

interface ReceivingData {
  id: string
  product: { name: string; sku: string }
  fromWarehouse: { name: string } | null
  toWarehouse: { name: string }
  quantityInitiated: number
  quantityReceived: number
  damagedQuantity: number
  unitCost?: number | null
  totalCost?: number | null
  receivedAt: string | null
  notes: string | null
}

function ReceivingReportPDF({ data }: { data: ReceivingData }) {
  const goodUnits = data.quantityReceived - data.damagedQuantity
  const unitCost = data.unitCost ?? 0
  const totalCost = data.totalCost ?? (unitCost * data.quantityReceived)

  return (
    <Document>
      <Page size="A4" style={receivingStyles.page}>
        <View style={receivingStyles.header}>
          <View>
            <Text style={receivingStyles.title}>Receiving Report</Text>
            <Text style={receivingStyles.subtitle}>Purchase Order Receipt</Text>
          </View>
          <View style={receivingStyles.badge}>
            <Text>{data.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={receivingStyles.section}>
            <Text style={receivingStyles.sectionTitle}>Supplier</Text>
            <View style={receivingStyles.row}>
              <Text style={receivingStyles.label}>Name</Text>
              <Text style={receivingStyles.value}>{data.fromWarehouse?.name ?? '?'}</Text>
            </View>
          </View>

          <View style={receivingStyles.section}>
            <Text style={receivingStyles.sectionTitle}>Shipment</Text>
            <View style={receivingStyles.row}>
              <Text style={receivingStyles.label}>Destination</Text>
              <Text style={receivingStyles.value}>{data.toWarehouse.name}</Text>
            </View>
            {data.receivedAt && (
              <View style={receivingStyles.row}>
                <Text style={receivingStyles.label}>Received On</Text>
                <Text style={receivingStyles.value}>{new Date(data.receivedAt).toLocaleDateString()}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={receivingStyles.section}>
          <Text style={receivingStyles.sectionTitle}>Line Items</Text>
          <View style={receivingStyles.tableHeader}>
            <Text style={{ ...receivingStyles.tableHeaderText, flex: 3 }}>Product</Text>
            <Text style={{ ...receivingStyles.tableHeaderText, flex: 1, textAlign: 'center' }}>SKU</Text>
            <Text style={{ ...receivingStyles.tableHeaderText, flex: 1, textAlign: 'right' }}>Ordered</Text>
            <Text style={{ ...receivingStyles.tableHeaderText, flex: 1, textAlign: 'right' }}>Received</Text>
            {unitCost > 0 && <Text style={{ ...receivingStyles.tableHeaderText, flex: 1, textAlign: 'right' }}>Unit Cost</Text>}
            {unitCost > 0 && <Text style={{ ...receivingStyles.tableHeaderText, flex: 1, textAlign: 'right' }}>Total</Text>}
          </View>
          <View style={receivingStyles.tableRow}>
            <Text style={{ flex: 3, fontSize: 10, color: '#1a1a1a' }}>{data.product.name}</Text>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 10, color: '#1a1a1a' }}>{data.product.sku}</Text>
            <Text style={{ flex: 1, textAlign: 'right', fontSize: 10, color: '#1a1a1a' }}>{data.quantityInitiated}</Text>
            <Text style={{ flex: 1, textAlign: 'right', fontSize: 10, color: '#1a1a1a' }}>{data.quantityReceived}</Text>
            {unitCost > 0 && <Text style={{ flex: 1, textAlign: 'right', fontSize: 10, color: '#1a1a1a' }}>${unitCost.toFixed(2)}</Text>}
            {unitCost > 0 && <Text style={{ flex: 1, textAlign: 'right', fontSize: 10, color: '#1a1a1a', fontWeight: 'bold' }}>${totalCost.toFixed(2)}</Text>}
          </View>
        </View>

        <View style={receivingStyles.section}>
          <Text style={receivingStyles.sectionTitle}>Receipt Summary</Text>
          <View style={receivingStyles.row}>
            <Text style={receivingStyles.label}>Ordered Qty</Text>
            <Text style={receivingStyles.value}>{data.quantityInitiated} units</Text>
          </View>
          <View style={receivingStyles.row}>
            <Text style={receivingStyles.label}>Received Qty</Text>
            <Text style={{ ...receivingStyles.value, color: '#2e7d32' }}>{data.quantityReceived} units</Text>
          </View>
          {data.damagedQuantity > 0 && (
            <View style={receivingStyles.row}>
              <Text style={receivingStyles.label}>Damaged</Text>
              <Text style={{ ...receivingStyles.value, color: '#d32f2f' }}>{data.damagedQuantity} units (written off)</Text>
            </View>
          )}
          <View style={receivingStyles.row}>
            <Text style={receivingStyles.label}>Good Units Added</Text>
            <Text style={{ ...receivingStyles.value, color: '#2e7d32' }}>{goodUnits} units</Text>
          </View>
          <View style={receivingStyles.row}>
            <Text style={receivingStyles.label}>Discrepancy</Text>
            <Text style={{ ...receivingStyles.value, color: data.quantityInitiated - data.quantityReceived > 0 ? '#d32f2f' : '#2e7d32' }}>
              {data.quantityInitiated - data.quantityReceived === 0 ? 'None' : `${data.quantityInitiated - data.quantityReceived} units short`}
            </Text>
          </View>
          {unitCost > 0 && (
            <View style={receivingStyles.row}>
              <Text style={receivingStyles.label}>Total Cost</Text>
              <Text style={{ ...receivingStyles.value, fontSize: 12 }}>${totalCost.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {data.notes && (
          <View style={receivingStyles.section}>
            <Text style={receivingStyles.sectionTitle}>Notes</Text>
            <Text style={{ color: '#333' }}>{data.notes}</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 }}>
          <View style={{ width: 200, borderTopWidth: 0.5, borderTopColor: '#333', paddingTop: 8 }}>
            <Text style={{ fontSize: 9, color: '#666' }}>Received by</Text>
          </View>
          <View style={{ width: 200, borderTopWidth: 0.5, borderTopColor: '#333', paddingTop: 8 }}>
            <Text style={{ fontSize: 9, color: '#666' }}>Verified by</Text>
          </View>
        </View>

        <View style={receivingStyles.footer}>
          <Text style={receivingStyles.footerText}>StockPilot - Inventory Management</Text>
          <Text style={receivingStyles.footerText}>Generated {new Date().toLocaleDateString()}</Text>
        </View>
      </Page>
    </Document>
  )
}

export function ReceivingReportDownload({ transfer }: { transfer: ReceivingData }) {
  return (
    <PDFDownloadLink
      document={<ReceivingReportPDF data={transfer} />}
      fileName={`receiving-${transfer.id.slice(0, 8)}.pdf`}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }) => (
        <button className="btn btn-ghost" style={{ gap: 6, fontSize: 12, padding: '6px 10px', minHeight: 'auto' }} disabled={loading}>
          <Download style={{ width: 14, height: 14 }} />
          {loading ? 'Generating...' : 'Receiving Report'}
        </button>
      )}
    </PDFDownloadLink>
  )
}
