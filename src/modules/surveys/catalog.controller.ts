import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('catalog')
export class CatalogController {
  constructor(private readonly svc: CatalogService) {}

  @Get('questions')
  @Roles('coordinator')
  listQuestions() {
    return this.svc.listQuestions();
  }

  @Get('responses')
  @Roles('coordinator')
  listResponses() {
    return this.svc.listResponses();
  }

  @Get('items')
  @Roles('coordinator')
  listItems() {
    return this.svc.listQuestionLists();
  }

  @Get('items/:id/questions')
  @Roles('coordinator')
  listItemsQuestions(@Param('id', ParseIntPipe) id: number) {
    return this.svc.listQuestionsOfList(id);
  }

  @Get('questions/:id/extended')
  @Roles('coordinator')
  getQuestionExtended(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getQuestionExtended(id);
  }

  @Get('questions/extended')
  @Roles('coordinator')
  getQuestionsExtended(@Query('ids') ids: string) {
    const parsed = (ids ?? '')
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isFinite(n));
    return this.svc.getQuestionsExtended(parsed);
  }
}
