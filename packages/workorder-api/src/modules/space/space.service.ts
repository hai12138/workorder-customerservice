import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSpaceDto, SpaceType, SpaceStatus } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { SpaceType as PrismaSpaceType, SpaceStatus as PrismaSpaceStatus } from '@prisma/client';

interface SpaceNode {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  type: string;
  status: string;
  createdAt: Date;
  children?: SpaceNode[];
}

// Enum mapping functions - DTO (Chinese) <-> Prisma (enum)
function mapTypeToDb(type: SpaceType): PrismaSpaceType {
  const mapping: Record<SpaceType, PrismaSpaceType> = {
    [SpaceType.BUILDING]: 'BUILDING' as PrismaSpaceType,
    [SpaceType.FLOOR]: 'FLOOR' as PrismaSpaceType,
    [SpaceType.ROOM]: 'ROOM' as PrismaSpaceType,
    [SpaceType.PUBLIC]: 'PUBLIC' as PrismaSpaceType,
    [SpaceType.PARKING]: 'PARKING' as PrismaSpaceType,
  };
  return mapping[type];
}

function mapStatusToDb(status: SpaceStatus): PrismaSpaceStatus {
  const mapping: Record<SpaceStatus, PrismaSpaceStatus> = {
    [SpaceStatus.AVAILABLE]: 'AVAILABLE' as PrismaSpaceStatus,
    [SpaceStatus.DISABLED]: 'DISABLED' as PrismaSpaceStatus,
  };
  return mapping[status];
}

function mapTypeFromDb(type: string): SpaceType {
  const mapping: Record<string, SpaceType> = {
    BUILDING: SpaceType.BUILDING,
    FLOOR: SpaceType.FLOOR,
    ROOM: SpaceType.ROOM,
    PUBLIC: SpaceType.PUBLIC,
    PARKING: SpaceType.PARKING,
  };
  return mapping[type] ?? SpaceType.BUILDING;
}

function mapStatusFromDb(status: string): SpaceStatus {
  const mapping: Record<string, SpaceStatus> = {
    AVAILABLE: SpaceStatus.AVAILABLE,
    DISABLED: SpaceStatus.DISABLED,
  };
  return mapping[status] ?? SpaceStatus.AVAILABLE;
}

@Injectable()
export class SpaceService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProject(projectId: string, asTree: boolean = false) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    const spaces = await this.prisma.space.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    const mappedSpaces = spaces.map((s) => ({
      id: s.id,
      projectId: s.projectId,
      parentId: s.parentId,
      name: s.name,
      type: mapTypeFromDb(s.type),
      status: mapStatusFromDb(s.status),
      createdAt: s.createdAt,
    }));

    if (asTree) {
      return this.buildTree(mappedSpaces, projectId, project.name);
    }

    return mappedSpaces;
  }

  private buildTree(spaces: any[], projectId: string, projectName: string) {
    // Create root node for project
    const root = {
      id: `project_${projectId}`,
      name: projectName,
      type: 'project',
      isRoot: true,
      children: [] as any[],
    };

    // Build map for quick lookup
    const spaceMap = new Map<string, any>();
    spaces.forEach((space) => {
      spaceMap.set(space.id, { ...space, children: [] });
    });

    // Build tree structure
    const rootSpaces: any[] = [];
    spaces.forEach((space) => {
      const node = spaceMap.get(space.id);
      if (!node) return;

      if (!space.parentId) {
        // First-level spaces belong to project
        rootSpaces.push(node);
      } else {
        const parent = spaceMap.get(space.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, treat as root level
          rootSpaces.push(node);
        }
      }
    });

    root.children = rootSpaces;
    return root;
  }

  async create(dto: CreateSpaceDto) {
    // Verify project exists
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    // Verify parent exists and belongs to same project if parentId provided
    if (dto.parentId) {
      const parent = await this.prisma.space.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException('父级空间不存在');
      }
      if (parent.projectId !== dto.projectId) {
        throw new BadRequestException('父级空间必须属于同一项目');
      }
    }

    const space = await this.prisma.space.create({
      data: {
        projectId: dto.projectId,
        parentId: dto.parentId || null,
        name: dto.name,
        type: mapTypeToDb(dto.type),
        status: dto.status ? mapStatusToDb(dto.status) : mapStatusToDb(SpaceStatus.AVAILABLE),
      },
    });

    return {
      id: space.id,
      projectId: space.projectId,
      parentId: space.parentId,
      name: space.name,
      type: mapTypeFromDb(space.type),
      status: mapStatusFromDb(space.status),
      createdAt: space.createdAt,
    };
  }

  async update(id: string, dto: UpdateSpaceDto) {
    const space = await this.prisma.space.findUnique({
      where: { id },
    });
    if (!space) {
      throw new NotFoundException('空间不存在');
    }

    // If updating parentId, validate
    if (dto.parentId !== undefined) {
      if (dto.parentId === null) {
        // Allow setting to null (root level)
      } else if (dto.parentId === id) {
        throw new BadRequestException('空间不能设置自己为父级');
      } else {
        // Verify parent exists and belongs to same project
        const parent = await this.prisma.space.findUnique({
          where: { id: dto.parentId },
        });
        if (!parent) {
          throw new NotFoundException('父级空间不存在');
        }
        if (parent.projectId !== space.projectId) {
          throw new BadRequestException('父级空间必须属于同一项目');
        }

        // Check for cycles
        await this.checkForCycle(id, dto.parentId);
      }
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.type !== undefined) updateData.type = mapTypeToDb(dto.type);
    if (dto.status !== undefined) updateData.status = mapStatusToDb(dto.status);
    if (dto.parentId !== undefined) updateData.parentId = dto.parentId;

    const updated = await this.prisma.space.update({
      where: { id },
      data: updateData,
    });

    return {
      id: updated.id,
      projectId: updated.projectId,
      parentId: updated.parentId,
      name: updated.name,
      type: mapTypeFromDb(updated.type),
      status: mapStatusFromDb(updated.status),
      createdAt: updated.createdAt,
    };
  }

  private async checkForCycle(spaceId: string, newParentId: string) {
    let currentId: string | null = newParentId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === spaceId) {
        throw new BadRequestException('不能创建循环引用');
      }
      if (visited.has(currentId)) {
        // Existing cycle in tree, but not involving this node
        break;
      }
      visited.add(currentId);

      const parent = await this.prisma.space.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      currentId = parent?.parentId ?? null;
    }
  }

  async delete(id: string) {
    const space = await this.prisma.space.findUnique({
      where: { id },
      include: {
        children: true,
      },
    });

    if (!space) {
      throw new NotFoundException('空间不存在');
    }

    if (space.children.length > 0) {
      throw new BadRequestException('该空间下存在子空间，无法删除');
    }

    await this.prisma.space.delete({
      where: { id },
    });

    return { id };
  }
}
