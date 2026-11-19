import { Order } from '@/types';

// Helper formatting 32-kolom untuk printer thermal 58mm
function formatLine(left: string, right: string, maxWidth = 32): string {
  const cleanLeft = left.trim();
  const cleanRight = right.trim();
  const spaceNeeded = maxWidth - cleanLeft.length - cleanRight.length;
  if (spaceNeeded <= 0) {
    // Jika tidak muat di satu baris, pecah
    return `${cleanLeft}\n${' '.repeat(Math.max(0, maxWidth - cleanRight.length))}${cleanRight}`;
  }
  return cleanLeft + ' '.repeat(spaceNeeded) + cleanRight;
}

function divider(char = '-', maxWidth = 32): string {
  return char.repeat(maxWidth);
}

function formatRupiah(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num);
}

// Layanan Bluetooth umum untuk printer thermal portabel 58mm
const KNOWN_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Standar printer thermal 1
  '0000ffe0-0000-1000-8000-00805f9b34fb', // Modul SPP-BLE standar
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  0x18f0,
  0xffe0,
];

export class BluetoothThermalPrinter {
  private device: any = null;
  private characteristic: any = null;

  isConnected(): boolean {
    return !!(this.device && this.device.gatt && this.device.gatt.connected && this.characteristic);
  }

  getDeviceName(): string {
    return this.device?.name || 'Printer Bluetooth';
  }

  async connect(): Promise<boolean> {
    if (typeof window === 'undefined' || !(navigator as any).bluetooth) {
      throw new Error('Web Bluetooth API tidak didukung di browser ini. Gunakan Google Chrome di Android/PC/Mac.');
    }

    try {
      this.device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_SERVICES,
      });

      if (!this.device) {
        throw new Error('Tidak ada printer yang dipilih.');
      }

      const server = await this.device.gatt.connect();
      
      // Cari service yang kompatibel
      let targetCharacteristic: any = null;
      for (const serviceId of KNOWN_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceId);
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              targetCharacteristic = char;
              break;
            }
          }
          if (targetCharacteristic) break;
        } catch {
          continue;
        }
      }

      if (!targetCharacteristic) {
        throw new Error('Karakteristik write Bluetooth printer tidak ditemukan.');
      }

      this.characteristic = targetCharacteristic;
      return true;
    } catch (err: any) {
      console.error('Koneksi Bluetooth gagal:', err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }

  // Kirim data buffer dalam pecahan (chunks) 50-100 bytes agar tidak drop di buffer BLE
  private async writeChunks(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      throw new Error('Printer belum terhubung.');
    }

    const CHUNK_SIZE = 64;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      if (this.characteristic.writeValueWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      // Delay mikro agar printer memproses buffer
      await new Promise((res) => setTimeout(res, 20));
    }
  }

  // Buat ESC/POS binary data untuk struk 58mm
  generateReceiptBuffer(order: Order): Uint8Array {
    const encoder = new TextEncoder();
    const parts: number[] = [];

    // ESC/POS Commands
    const ESC = 0x1b;

    // Reset printer
    parts.push(ESC, 0x40);

    // Header Center
    parts.push(ESC, 0x61, 0x01); // Align center
    parts.push(ESC, 0x45, 0x01); // Bold on
    parts.push(ESC, 0x21, 0x10); // Double height
    parts.push(...encoder.encode('AYAM DUBRAK!\n'));
    parts.push(ESC, 0x21, 0x00); // Normal size
    parts.push(ESC, 0x45, 0x00); // Bold off
    parts.push(...encoder.encode('Perumahan Bukit Alam Permai No.1 D4\nLangkapura, Kota Bandar Lampung\n'));
    parts.push(...encoder.encode(divider('=') + '\n'));

    // Align Center - NOMOR ANTREAN BESAR
    parts.push(ESC, 0x45, 0x01); // Bold on
    parts.push(ESC, 0x21, 0x30); // Double height & width
    parts.push(...encoder.encode(` ${order.queue_code} \n`));
    parts.push(ESC, 0x21, 0x00); // Normal size
    parts.push(ESC, 0x45, 0x00); // Bold off

    // Align Left - Info Pesanan
    parts.push(ESC, 0x61, 0x00); // Align left
    parts.push(...encoder.encode(formatLine('No. Pesanan', order.queue_code) + '\n'));
    if (order.table_number) {
      parts.push(...encoder.encode(formatLine('Nomor Meja', `Meja ${order.table_number}`) + '\n'));
    }
    const orderDate = new Date(order.created_at).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    parts.push(...encoder.encode(formatLine('Waktu Order', orderDate) + '\n'));
    
    const timeLabel = order.is_asap ? 'Sekarang (Langsung)' : `Jam ${order.pickup_scheduled_time}`;
    parts.push(...encoder.encode(formatLine('Jam Pickup', timeLabel) + '\n'));
    parts.push(...encoder.encode(formatLine('Pelanggan', `${order.customer_name} (${order.customer_phone})`) + '\n'));

    parts.push(...encoder.encode(divider('-') + '\n'));

    // Daftar Menu
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        const itemLine = `${item.quantity}x ${item.item_name}`;
        const priceStr = formatRupiah(item.subtotal);
        parts.push(...encoder.encode(formatLine(itemLine, priceStr) + '\n'));

        // Modifiers (Sambal & Add-ons)
        if (item.modifiers && item.modifiers.length > 0) {
          for (const mod of item.modifiers) {
            const qty = (mod as any).quantity && (mod as any).quantity > 1 ? `${(mod as any).quantity}x ` : '';
            const totalModPrice = mod.price * ((mod as any).quantity || 1);
            const modPrice = totalModPrice > 0 ? `+${formatRupiah(totalModPrice)}` : '';
            parts.push(...encoder.encode(formatLine(`   - ${qty}${mod.option_name}`, modPrice) + '\n'));
          }
        }

        // Catatan item
        if (item.notes) {
          parts.push(...encoder.encode(`   * Catatan: ${item.notes}\n`));
        }
      }
    }

    parts.push(...encoder.encode(divider('-') + '\n'));

    // Total & Pembayaran
    parts.push(ESC, 0x45, 0x01); // Bold on
    parts.push(...encoder.encode(formatLine('Total Bayar', `Rp ${formatRupiah(order.total_amount)}`) + '\n'));
    parts.push(...encoder.encode(formatLine('Metode Bayar', order.payment_method || 'CASH') + '\n'));
    const statusLabel = order.status === 'MENUNGGU_BAYAR' ? 'BELUM BAYAR' : 'LUNAS';
    parts.push(...encoder.encode(formatLine('Status', statusLabel) + '\n'));
    parts.push(ESC, 0x45, 0x00); // Bold off

    // Catatan Global Pesanan
    if (order.notes) {
      parts.push(...encoder.encode(`Catatan: ${order.notes}\n`));
    }

    parts.push(...encoder.encode(divider('=') + '\n'));

    // Footer
    parts.push(ESC, 0x61, 0x01); // Align center
    parts.push(...encoder.encode('Terima kasih sudah memesan!\n'));
    parts.push(...encoder.encode('Mohon tunggu nomor pesanan\n'));
    parts.push(...encoder.encode('dipanggil kasir.\n'));

    // Feed lines & cut
    parts.push(0x0a, 0x0a, 0x0a, 0x0a); // 4 line feeds

    return new Uint8Array(parts);
  }

  async printReceipt(order: Order): Promise<void> {
    const buffer = this.generateReceiptBuffer(order);
    await this.writeChunks(buffer);
  }
}

// Global singleton instance for browser
let printerInstance: BluetoothThermalPrinter | null = null;

export function getBluetoothPrinter(): BluetoothThermalPrinter {
  if (!printerInstance) {
    printerInstance = new BluetoothThermalPrinter();
  }
  return printerInstance;
}
