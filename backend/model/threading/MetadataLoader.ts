import {VideoMetadata} from '../../../common/entities/VideoDTO';
import {PhotoMetadata} from '../../../common/entities/PhotoDTO';
import {Config} from '../../../common/config/private/Config';
import {Logger} from '../../Logger';
import * as fs from 'fs';
import * as sizeOf from 'image-size';
import {OrientationTypes, ExifParserFactory} from 'ts-exif-parser';
import {IptcParser} from 'ts-node-iptc';
import {FFmpegFactory} from '../FFmpegFactory';
import {FfprobeData} from 'fluent-ffmpeg';

const LOG_TAG = '[MetadataLoader]';
const ffmpeg = FFmpegFactory.get();

export class MetadataLoader {

  public static loadVideoMetadata(fullPath: string): Promise<VideoMetadata> {
    return new Promise<VideoMetadata>((resolve, reject) => {
      const metadata: VideoMetadata = {
        size: {
          width: 1,
          height: 1
        },
        bitRate: 0,
        duration: 0,
        creationDate: 0,
        fileSize: 0
      };
      try {
        const stat = fs.statSync(fullPath);
        metadata.fileSize = stat.size;
      } catch (err) {
      }
      ffmpeg(fullPath).ffprobe((err: any, data: FfprobeData) => {
        if (!!err || data === null) {
          return reject(err);
        }

        if (!data.streams[0]) {
          return resolve(metadata);
        }

        try {
          for (let i = 0; i < data.streams.length; i++) {
            if (data.streams[i].width) {
              metadata.size.width = data.streams[i].width;
              metadata.size.height = data.streams[i].height;

              metadata.duration = Math.floor(data.streams[i].duration * 1000);
              metadata.bitRate = parseInt(data.streams[i].bit_rate, 10) || null;
              metadata.creationDate = Date.parse(data.streams[i].tags.creation_time);
              break;
            }
          }

        } catch (err) {
        }

        return resolve(metadata);
      });
    });
  }

  public static loadPhotoMetadata(fullPath: string): Promise<PhotoMetadata> {
    return new Promise<PhotoMetadata>((resolve, reject) => {
        const fd = fs.openSync(fullPath, 'r');

        const data = Buffer.allocUnsafe(Config.Server.photoMetadataSize);
        fs.read(fd, data, 0, Config.Server.photoMetadataSize, 0, (err) => {
          fs.closeSync(fd);
          if (err) {
            return reject({file: fullPath, error: err});
          }
          const metadata: PhotoMetadata = {
            size: {width: 1, height: 1},
            orientation: OrientationTypes.TOP_LEFT,
            creationDate: 0,
            fileSize: 0
          };
          try {

            try {
              const stat = fs.statSync(fullPath);
              metadata.fileSize = stat.size;
              metadata.creationDate = stat.ctime.getTime();
            } catch (err) {
            }

            try {
              const exif = ExifParserFactory.create(data).parse();
              if (exif.tags.ISO || exif.tags.Model ||
                exif.tags.Make || exif.tags.FNumber ||
                exif.tags.ExposureTime || exif.tags.FocalLength ||
                exif.tags.LensModel) {
                metadata.cameraData = {
                  ISO: exif.tags.ISO,
                  model: exif.tags.Model,
                  make: exif.tags.Make,
                  fStop: exif.tags.FNumber,
                  exposure: exif.tags.ExposureTime,
                  focalLength: exif.tags.FocalLength,
                  lens: exif.tags.LensModel,
                };
              }
              if (!isNaN(exif.tags.GPSLatitude) || exif.tags.GPSLongitude || exif.tags.GPSAltitude) {
                metadata.positionData = metadata.positionData || {};
                metadata.positionData.GPSData = {
                  latitude: exif.tags.GPSLatitude,
                  longitude: exif.tags.GPSLongitude,
                  altitude: exif.tags.GPSAltitude
                };
              }

              if (exif.tags.CreateDate || exif.tags.DateTimeOriginal || exif.tags.ModifyDate) {
                metadata.creationDate = exif.tags.CreateDate || exif.tags.DateTimeOriginal || exif.tags.ModifyDate;
              }

              if (exif.tags.Orientation) {
                metadata.orientation = exif.tags.Orientation;
              }

              if (exif.imageSize) {
                metadata.size = {width: exif.imageSize.width, height: exif.imageSize.height};
              } else if (exif.tags.RelatedImageWidth && exif.tags.RelatedImageHeight) {
                metadata.size = {width: exif.tags.RelatedImageWidth, height: exif.tags.RelatedImageHeight};
              } else {
                const info = sizeOf(fullPath);
                metadata.size = {width: info.width, height: info.height};
              }
            } catch (err) {
              Logger.debug(LOG_TAG, 'Error parsing exif', fullPath, err);
              try {
                const info = sizeOf(fullPath);
                metadata.size = {width: info.width, height: info.height};
              } catch (e) {
                metadata.size = {width: 1, height: 1};
              }
            }

            try {
              const iptcData = IptcParser.parse(data);
              if (iptcData.country_or_primary_location_name || iptcData.province_or_state || iptcData.city) {
                metadata.positionData = metadata.positionData || {};
                metadata.positionData.country = iptcData.country_or_primary_location_name.replace(/\0/g, '').trim();
                metadata.positionData.state = iptcData.province_or_state.replace(/\0/g, '').trim();
                metadata.positionData.city = iptcData.city.replace(/\0/g, '').trim();
              }
              if (iptcData.caption) {
                metadata.caption = iptcData.caption.replace(/\0/g, '').trim();
              }
              metadata.keywords = iptcData.keywords || [];
              metadata.creationDate = <number>(iptcData.date_time ? iptcData.date_time.getTime() : metadata.creationDate);

            } catch (err) {
              //  Logger.debug(LOG_TAG, 'Error parsing iptc data', fullPath, err);
            }

            metadata.creationDate = metadata.creationDate || 0;

            return resolve(metadata);
          } catch (err) {
            return reject({file: fullPath, error: err});
          }
        });
      }
    );
  }
}
