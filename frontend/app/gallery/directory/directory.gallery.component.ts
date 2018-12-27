import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {DirectoryDTO} from '../../../../common/entities/DirectoryDTO';
import {RouterLink} from '@angular/router';
import {Utils} from '../../../../common/Utils';
import {Media} from '../Media';
import {Thumbnail, ThumbnailManagerService} from '../thumbnailManager.service';
import {PageHelper} from '../../model/page.helper';
import {QueryService} from '../../model/query.service';
import {PhotoDTO} from '../../../../common/entities/PhotoDTO';
import {MediaDTO} from '../../../../common/entities/MediaDTO';

@Component({
  selector: 'app-gallery-directory',
  templateUrl: './directory.gallery.component.html',
  styleUrls: ['./directory.gallery.component.css'],
  providers: [RouterLink],
})
export class GalleryDirectoryComponent implements OnInit, OnDestroy {
  @Input() directory: DirectoryDTO;
  @ViewChild('dirContainer') container: ElementRef;
  thumbnail: Thumbnail = null;

  constructor(private thumbnailService: ThumbnailManagerService,
              private _sanitizer: DomSanitizer,
              public queryService: QueryService) {

  }

  size: number = null;

  public get SamplePhoto(): MediaDTO {
    if (this.directory.media.length > 0) {
      return this.directory.media[0];
    }
    
    // Look for a thumbnail from a subdirectory by doing a BFS.
    if (this.directory.directories != null && this.directory.directories.length > 0) { 
      let queue = Object.assign([], this.directory.directories);
      while (queue.length > 0) {
        let directory = queue.shift();
        if (directory.media.length > 0) {
          return directory.media[0];
        }
        for (let subdirectory of directory) {
          queue.push(subdirectory);
        }
      }
    }

    return null;
  }

  getSanitizedThUrl() {
    return this._sanitizer.bypassSecurityTrustStyle('url(' +
      encodeURI(this.thumbnail.Src)
        .replace(/\(/g, '%28')
        .replace(/'/g, '%27')
        .replace(/\)/g, '%29') + ')');
  }

  // TODO: implement scroll
  isInView(): boolean {
    return document.body.scrollTop < this.container.nativeElement.offsetTop + this.container.nativeElement.clientHeight
      && document.body.scrollTop + window.innerHeight > this.container.nativeElement.offsetTop;
  }

  getDirectoryPath() {
    return Utils.concatUrls(this.directory.path, this.directory.name);
  }

  ngOnDestroy() {
    if (this.thumbnail != null) {
      this.thumbnail.destroy();
    }
  }

  ngOnInit() {
    if (this.directory.media.length > 0) {
      this.thumbnail = this.thumbnailService.getThumbnail(new Media(this.SamplePhoto, this.calcSize(), this.calcSize()));
    }
  }

  calcSize() {
    if (this.size == null || PageHelper.isScrollYVisible()) {
      const size = 220 + 5;
      const containerWidth = this.container.nativeElement.parentElement.parentElement.clientWidth;
      this.size = containerWidth / Math.round((containerWidth / size));
    }
    return Math.floor(this.size - 5);
  }

}

